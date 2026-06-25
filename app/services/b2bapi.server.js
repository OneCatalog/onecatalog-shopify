// Клиент B2B-фида (§13.1): url_key в пути + private_key в query.
export class B2bApi {
  constructor(base, urlKey, privateKey) {
    this.base = String(base || "").replace(/\/+$/, "");
    this.urlKey = String(urlKey || "");
    this.privateKey = String(privateKey || "");
  }
  configured() { return !!this.urlKey && !!this.privateKey; }
  async fetchPage(start = 0, limit = 200) {
    if (!this.configured()) return null;
    const qs = new URLSearchParams({ private_key: this.privateKey, start: String(Math.max(0, start)), limit: String(Math.max(1, limit)) });
    const url = `${this.base}/retailer-share-products/${encodeURIComponent(this.urlKey)}/?${qs}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      return json && typeof json === "object" ? json : null;
    } catch (e) { return null; }
  }
  async total() {
    const d = await this.fetchPage(0, 1);
    return d ? Number(d.meta?.counts ?? d.meta?.total ?? 0) | 0 : 0;
  }
}
