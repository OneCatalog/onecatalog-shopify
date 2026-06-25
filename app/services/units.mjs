// Конвертер единиц (§5.6). OneCatalog: вес — граммы, размеры — миллиметры.
// Чистый ESM-модуль (node-тестируемый), используется сервисами приложения.
const WEIGHT = { g:1, gr:1, gram:1, "г":1, "гр":1, kg:0.001, kgs:0.001, "кг":0.001,
  lb:0.00220462, lbs:0.00220462, oz:0.0352739, t:0.000001, "т":0.000001 };
const LENGTH = { mm:1, "мм":1, cm:0.1, "см":0.1, dm:0.01, "дм":0.01, m:0.001, "м":0.001,
  in:0.0393701, inch:0.0393701, '"':0.0393701, "дюйм":0.0393701, ft:0.00328084 };

function factor(table, unit) {
  const u = String(unit ?? "").trim().toLowerCase();
  return u && Object.prototype.hasOwnProperty.call(table, u) ? table[u] : null;
}
export function weight(grams, unit) { const f = factor(WEIGHT, unit); return f === null ? Number(grams) : Number(grams) * f; }
export function length(mm, unit) { const f = factor(LENGTH, unit); return f === null ? Number(mm) : Number(mm) * f; }
export function toBaseWeight(v, unit) { const f = factor(WEIGHT, unit); return (f === null || f === 0) ? Number(v) : Number(v) / f; }
export function toBaseLength(v, unit) { const f = factor(LENGTH, unit); return (f === null || f === 0) ? Number(v) : Number(v) / f; }
