// Ядро импорта одного товара (Shopify Admin GraphQL, §5).
// Идемпотентность по OneCatalogMap (shop+publicId→productGid, §5.1). Цена 0 и статус —
// только при создании (§5.6). Характеристики → metafields; категории → custom collections.
import * as Units from "./units.mjs";
import { Api, getSettings } from "./api.server";

async function gql(admin, query, variables) {
  const res = await admin.graphql(query, { variables });
  const body = await res.json();
  return body?.data ?? null;
}

export async function importByPublicId({ admin, prisma, shop, publicId }) {
  const cfg = await getSettings(prisma, shop);
  const api = new Api(cfg.api_base, cfg.api_token, cfg.lang);
  const payload = await api.getProduct(publicId);
  if (!payload) return { status: "error", publicId, message: "product not found in API" };
  return importPayload({ admin, prisma, shop, cfg, payload, publicId });
}

export async function importPayload({ admin, prisma, shop, cfg, payload, publicId }) {
  publicId = String(publicId ?? payload.public_id ?? "");
  if (!publicId) return { status: "error", publicId: "", message: "empty public_id" };

  const name = String(payload.name ?? payload.title ?? payload.menutitle ?? "").trim();
  const description = String(payload.description_text ?? payload.description ?? "");
  const article = String(payload.article ?? "").trim();
  const dim = resolveDimensions(payload);

  try {
    const existing = await prisma.oneCatalogMap.findUnique({
      where: { shop_publicId: { shop, publicId } },
    });
    let gid = existing?.productGid || null;
    const isNew = !gid;

    if (isNew && !name) return { status: "error", publicId, message: "empty product name" };

    if (isNew) {
      const data = await gql(
        admin,
        `mutation oc_create($input: ProductInput!) {
          productCreate(input: $input) { product { id variants(first: 1) { nodes { id } } } userErrors { field message } }
        }`,
        { input: { title: name, descriptionHtml: description, status: cfg.new_active ? "ACTIVE" : "DRAFT" } }
      );
      const err = data?.productCreate?.userErrors?.[0];
      if (err) return { status: "error", publicId, message: err.message };
      gid = data.productCreate.product.id;
      const variantId = data.productCreate.product.variants.nodes[0]?.id;
      await prisma.oneCatalogMap.create({ data: { shop, publicId, productGid: gid } });
      await updateVariant(admin, gid, variantId, article, dim, isNew);
    } else {
      await gql(
        admin,
        `mutation oc_update($input: ProductInput!) {
          productUpdate(input: $input) { userErrors { field message } }
        }`,
        { input: { id: gid, title: name || undefined, descriptionHtml: description } }
      );
      await updateVariant(admin, gid, null, article, dim, isNew);
    }

    await setMetafields(admin, gid, publicId, payload);
    await assignCollections(admin, gid, payload);

    return { status: isNew ? "created" : "updated", publicId, gid };
  } catch (e) {
    return { status: "error", publicId, message: e?.message || String(e) };
  }
}

async function updateVariant(admin, productGid, variantId, article, dim, isNew) {
  // Если variantId неизвестен (апдейт) — берём первый вариант товара.
  if (!variantId) {
    const d = await gql(
      admin,
      `query oc_var($id: ID!) { product(id: $id) { variants(first: 1) { nodes { id } } } }`,
      { id: productGid }
    );
    variantId = d?.product?.variants?.nodes?.[0]?.id;
  }
  if (!variantId) return;

  const inventoryItem = { sku: article || undefined };
  if (dim.weight !== null) {
    inventoryItem.measurement = { weight: { value: dim.weight, unit: "KILOGRAMS" } };
  }
  const variant = { id: variantId, inventoryItem };
  if (isNew) variant.price = "0"; // §5.6 — цену не синтезируем

  await gql(
    admin,
    `mutation oc_vbu($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
    }`,
    { productId: productGid, variants: [variant] }
  );
}

async function setMetafields(admin, gid, publicId, payload) {
  const metafields = [
    { ownerId: gid, namespace: "onecatalog", key: "public_id", type: "single_line_text_field", value: publicId },
  ];
  for (const opt of payload.options || []) {
    if (!opt || typeof opt !== "object") continue;
    const label = String(opt.specification_label || "").trim();
    if (!label) continue;
    const type = String(opt.specification_type || "text");
    let val;
    if (type === "numeric") val = opt.numeric_option == null || opt.numeric_option === "" ? "" : String(opt.numeric_option);
    else if (type === "boolean") val = opt.bool_option === true ? "Yes" : "No";
    else val = String(opt.specification_option_name || "").trim();
    if (!val) continue;
    const key = ("spec_" + slug(label)).slice(0, 30);
    metafields.push({ ownerId: gid, namespace: "onecatalog", key, type: "single_line_text_field", value: val });
  }
  // Чанками по 25 (лимит metafieldsSet).
  for (let i = 0; i < metafields.length; i += 25) {
    await gql(
      admin,
      `mutation oc_mf($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { userErrors { field message } }
      }`,
      { metafields: metafields.slice(i, i + 25) }
    );
  }
}

async function assignCollections(admin, gid, payload) {
  const cats = payload.categories;
  if (!Array.isArray(cats) || !cats.length) return;
  for (const cat of cats) {
    const title = String(cat?.menutitle ?? cat?.name ?? "").trim();
    if (!title) continue;
    const collId = await ensureCollection(admin, title);
    if (collId) {
      await gql(
        admin,
        `mutation oc_addcol($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } }
        }`,
        { id: collId, productIds: [gid] }
      );
    }
  }
}

async function ensureCollection(admin, title) {
  const found = await gql(
    admin,
    `query oc_findcol($q: String!) { collections(first: 1, query: $q) { nodes { id title } } }`,
    { q: `title:'${title.replace(/'/g, "\\'")}'` }
  );
  const node = found?.collections?.nodes?.[0];
  if (node && node.title.toLowerCase() === title.toLowerCase()) return node.id;
  const created = await gql(
    admin,
    `mutation oc_mkcol($input: CollectionInput!) {
      collectionCreate(input: $input) { collection { id } userErrors { field message } }
    }`,
    { input: { title } }
  );
  return created?.collectionCreate?.collection?.id || null;
}

function resolveDimensions(payload) {
  const sizes = payload.sizes && typeof payload.sizes === "object" ? payload.sizes : {};
  const base = (keys, unitKey, kind) => {
    for (const k of keys) {
      if (sizes[k] != null && sizes[k] !== "" && !isNaN(Number(sizes[k]))) {
        const v = Number(sizes[k]);
        const u = String(sizes[unitKey] || "");
        if (u) return kind === "weight" ? Units.toBaseWeight(v, u) : Units.toBaseLength(v, u);
        return v;
      }
    }
    return null;
  };
  const g = base(["weight"], "weight_unit", "weight");
  return { weight: g === null ? null : Units.weight(g, "kg") };
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "x";
}
