// Чистые резолверы B2B (§13), ESM. Зеркало логики PHP-портов.
import { createHash } from "node:crypto";

export function offerSupplierId(o) {
  if (o && o.supplier_id != null) return Number(o.supplier_id) | 0;
  return Number(o?.supplier?.id ?? 0) | 0;
}

export function priceForOffer(offer, regionPriority) {
  const byRegion = {};
  for (const pr of offer?.product_prices || []) {
    const rid = Number(pr?.region_id ?? 0) | 0;
    if (rid > 0 && !(rid in byRegion)) byRegion[rid] = pr;
  }
  const keys = Object.keys(byRegion);
  if (!keys.length) return null;
  const order = (regionPriority && regionPriority.length) ? regionPriority : keys.map(Number);
  for (const rid of order) {
    const pr = byRegion[Number(rid)];
    if (!pr) continue;
    const base = Number(pr.base_price ?? 0);
    if (base > 0) {
      return {
        base,
        promo: Number(pr.promo_price ?? 0),
        purchasing: pr.purchasing_price != null ? Number(pr.purchasing_price) : null,
      };
    }
  }
  return null;
}

export function priceWithSale(price, promoAsSale) {
  let sale = null;
  if (promoAsSale && price.promo > 0 && price.promo < price.base) sale = price.promo;
  return { regular: price.base, sale, purchasing: price.purchasing };
}

export function resolvePrice(offers, regionPriority, supplierPriority, strategy = "priority", supplierFixed = 0, promoAsSale = true) {
  const none = { regular: null, sale: null, purchasing: null };
  const candidates = strategy === "supplier" ? offers.filter((o) => offerSupplierId(o) === Number(supplierFixed)) : offers;
  const priced = [];
  for (const o of candidates) {
    const p = priceForOffer(o, regionPriority);
    if (p) priced.push({ offer: o, price: p });
  }
  if (!priced.length) return none;
  if (strategy === "priority" && supplierPriority && supplierPriority.length) {
    for (const sid of supplierPriority) {
      for (const row of priced) {
        if (offerSupplierId(row.offer) === Number(sid)) return priceWithSale(row.price, promoAsSale);
      }
    }
  }
  if (strategy === "supplier") return priceWithSale(priced[0].price, promoAsSale);
  priced.sort((a, b) => a.price.base - b.price.base);
  return priceWithSale(priced[0].price, promoAsSale);
}

export function resolveStock(offers) {
  let sum = 0;
  for (const o of offers) for (const s of o?.products_stocks || []) sum += Number(s.quantity ?? s.amount ?? 0);
  return sum;
}

export function anyAvailable(offers) {
  return offers.some((o) => !!o?.status);
}

export function extractCodes(offers) {
  const out = [];
  const seen = new Set();
  for (const o of offers) {
    const code = String(o?.code ?? "").trim();
    if (!code) continue;
    const sid = offerSupplierId(o);
    const key = sid + "|" + code;
    if (!seen.has(key)) { seen.add(key); out.push({ supplier_id: sid, code }); }
  }
  return out;
}

export function signature(r) {
  const manage = !!r.manage;
  return createHash("md5").update([
    r.regular == null ? "-" : String(Number(r.regular)),
    r.sale == null ? "-" : String(Number(r.sale)),
    manage ? "m" : "s",
    manage && r.qty != null ? String(Number(r.qty)) : "-",
    String(r.status ?? ""),
  ].join("|")).digest("hex");
}

export function resolveRecord(offers, cfg) {
  const price = resolvePrice(offers, cfg.region_prio || [], cfg.supplier_prio || [],
    cfg.strategy || "priority", cfg.supplier_fix || 0, !!cfg.promo_as_sale);
  const stock = resolveStock(offers);
  const available = anyAvailable(offers) && stock > 0;
  const manage = !!cfg.manage_stock;
  const qty = manage ? (cfg.decimal_stock ? stock : Math.floor(stock)) : null;
  const rec = {
    regular: price.regular, sale: price.sale, purchasing: price.purchasing ?? null,
    manage, qty, stock_raw: stock, status: available ? "instock" : "outofstock",
  };
  rec.sig = signature(rec);
  return rec;
}
