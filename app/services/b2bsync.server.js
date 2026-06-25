// §13 синхронизация цен/остатков (Shopify Admin GraphQL) — scan-and-diff.
import { B2bApi } from "./b2bapi.server";
import * as PS from "./pricestock.mjs";
import { getSettings } from "./api.server";

async function gql(admin, query, variables) {
  const res = await admin.graphql(query, { variables });
  return (await res.json())?.data ?? null;
}

function buildCfg(cfg) {
  const csv = (s) => String(s || "").split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number);
  return {
    region_prio: csv(cfg.b2b_region_priority),
    supplier_prio: csv(cfg.b2b_supplier_priority),
    strategy: cfg.b2b_strategy || "min",
    supplier_fix: parseInt(cfg.b2b_supplier_fixed || "0", 10) || 0,
    promo_as_sale: String(cfg.b2b_promo_as_sale) !== "0",
    manage_stock: String(cfg.b2b_manage_stock) === "1",
    decimal_stock: false,
  };
}

async function primaryLocation(admin) {
  const d = await gql(admin, `query oc_loc { locations(first: 1) { nodes { id } } }`, {});
  return d?.locations?.nodes?.[0]?.id || null;
}

export async function processPage({ admin, prisma, shop, start = 0, limit = 200 }) {
  const cfg = await getSettings(prisma, shop);
  const api = new B2bApi(cfg.b2b_base, cfg.b2b_url_key, cfg.b2b_private_key);
  if (!api.configured()) return { error: "b2b not configured" };
  const data = await api.fetchPage(start, limit);
  if (!data) return { error: "feed fetch failed", next: start, more: false };

  const total = Number(data.meta?.counts ?? data.meta?.total ?? 0) | 0;
  const known = data.products?.known ?? {};
  const publicIds = Object.keys(known);

  const rows = await prisma.oneCatalogMap.findMany({ where: { shop, publicId: { in: publicIds } } });
  const map = {};
  for (const r of rows) map[r.publicId] = r.productGid;
  const gids = Object.values(map);
  const sigRows = await prisma.oneCatalogMeta.findMany({ where: { shop, productGid: { in: gids }, metaKey: "pricestock_sig" } });
  const sigs = {};
  for (const r of sigRows) sigs[r.productGid] = r.value;

  const rcfg = buildCfg(cfg);
  const locationId = rcfg.manage_stock ? await primaryLocation(admin) : null;

  let scanned = 0, changed = 0, unchanged = 0, missing = 0;
  for (const [publicId, offers] of Object.entries(known)) {
    scanned++;
    const gid = map[publicId];
    if (!gid) { missing++; continue; }
    const rec = PS.resolveRecord(offers, rcfg);
    if (sigs[gid] === rec.sig) { unchanged++; continue; }
    try {
      await applyResolved({ admin, prisma, shop, gid, rec, offers, locationId });
      changed++;
    } catch (e) { /* не валим синк */ }
  }

  const next = start + limit;
  const more = scanned > 0 && (total > 0 ? next < total : scanned >= limit);
  return { scanned, changed, unchanged, missing, total, next, more };
}

async function applyResolved({ admin, prisma, shop, gid, rec, offers, locationId }) {
  const d = await gql(admin, `query oc_var($id: ID!) {
    product(id: $id) { variants(first: 1) { nodes { id inventoryItem { id } } } }
  }`, { id: gid });
  const variant = d?.product?.variants?.nodes?.[0];
  if (!variant) return;

  if (rec.regular !== null) {
    const price = rec.sale !== null ? String(rec.sale) : String(rec.regular);
    const compareAt = rec.sale !== null ? String(rec.regular) : null;
    await gql(admin, `mutation oc_vbu($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
    }`, { productId: gid, variants: [{ id: variant.id, price, compareAtPrice: compareAt }] });
  }

  if (rec.manage && variant.inventoryItem?.id && locationId) {
    await gql(admin, `mutation oc_inv($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) { userErrors { field message } }
    }`, { input: {
      name: "available", reason: "correction", ignoreCompareQuantity: true,
      quantities: [{ inventoryItemId: variant.inventoryItem.id, locationId, quantity: Math.round(Number(rec.qty) || 0) }],
    } });
  }

  await metaSet(prisma, shop, gid, "pricestock_sig", String(rec.sig));
  const codes = PS.extractCodes(offers).map((c) => `${c.supplier_id}:${c.code}`).join(",");
  await metaSet(prisma, shop, gid, "supplier_code", codes);
}

async function metaSet(prisma, shop, productGid, metaKey, value) {
  await prisma.oneCatalogMeta.upsert({
    where: { shop_productGid_metaKey: { shop, productGid, metaKey } },
    update: { value },
    create: { shop, productGid, metaKey, value },
  });
}
