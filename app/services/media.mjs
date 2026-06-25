// Медиа-хелперы (§2.3, §5.3), чистый ESM. Shopify сам тянет картинку по URL
// (productCreateMedia originalSource), поэтому ручное скачивание не нужно — берём выбор
// размера и контент-ключ для сигнатуры идемпотентности набора.
import { createHash } from "node:crypto";

export function pickSizeInfo(urls, hasToken) {
  const order = hasToken ? ["max", "middle", "min"] : ["middle", "max", "min"];
  for (const size of order) {
    if (urls && urls[size]) return { url: String(urls[size]), size };
  }
  return { url: "", size: "" };
}

export function sizeRank(size) {
  return { min: 1, middle: 2, max: 3 }[size] || 0;
}

// Стабильный контент-ключ из base64-префикса media_files («size|path|token») → sha1(path#size).
export function fileKey(url) {
  const m = String(url || "").match(/\/media_files\/([A-Za-z0-9_-]+)/);
  if (!m) return "";
  const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
  let raw = "";
  try { raw = Buffer.from(b64, "base64").toString("utf8"); } catch (e) { return ""; }
  if (!raw.includes("|")) return "";
  const parts = raw.split("|");
  const size = parts[0] || "";
  const path = parts[1] || "";
  if (!path) return "";
  return createHash("sha1").update(path + "#" + size).digest("hex");
}
