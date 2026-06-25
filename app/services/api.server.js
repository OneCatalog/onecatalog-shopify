// Клиент OneCatalog Wiki API (§2.1). Node 18+ global fetch.
export class Api {
  constructor(base, token, lang) {
    this.base = String(base || "").replace(/\/+$/, "");
    this.token = String(token || "");
    this.lang = String(lang || "en");
  }
  async get(url) {
    const sep = url.includes("?") ? "&" : "?";
    const headers = {};
    if (this.token) headers["X-API-Key"] = this.token;
    try {
      const res = await fetch(`${url}${sep}lang=${encodeURIComponent(this.lang)}`, { headers });
      if (!res.ok) return null;
      const json = await res.json();
      return json && typeof json === "object" ? json : null;
    } catch (e) {
      return null;
    }
  }
  async getProduct(publicId) {
    const pid = String(publicId || "").trim();
    if (!pid) return null;
    const r = await this.get(`${this.base}/products/${encodeURIComponent(pid)}/`);
    return r && r.success && r.data && typeof r.data === "object" ? r.data : null;
  }
}

// Настройки на магазин (Prisma Setting) с дефолтами.
export async function getSettings(prisma, shop) {
  const rows = await prisma.setting.findMany({ where: { shop } });
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    api_base: map.api_base || "https://api.onecatalog.net/wiki/v1",
    api_token: map.api_token || "",
    lang: map.lang || "en",
    step: Math.max(10, parseInt(map.step || "10", 10) || 10),
    new_active: map.new_active !== "0",
    ...map,
  };
}
