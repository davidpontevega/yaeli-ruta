// Turns the AI reading of a supplier document into receipt lines. Pure: no DB, no React.

export const MAX_READ_LINES = 80;

/** 60.5 | "60,50" | "S/ 1,234.50" → céntimos. null when not a positive amount. */
function toCents(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/S\/|\s/gi, "");
  // "1,234.50" → thousands comma; "60,50" → decimal comma
  s = /,\d{1,2}$/.test(s) && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** "2027-03-31" | "31/03/2027" | "31-03-27" → "2027-03-31"; anything else → null. */
function toIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return null;
  const [y, m, d] = parts;
  const date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const t = Date.parse(date); // "2027-02-31" parses as March 3: round-trip to reject it
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(date) ? date : null;
}

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function toQuantity(v: unknown) {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
}

export type ReadLine = {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  expiresOn: string | null;
};
export type ReadDocument = { supplier: string | null; document: string | null; total: number | null; lines: ReadLine[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates the model's JSON. Drops lines without description or with quantity ≤ 0. null if it isn't the expected object. */
export function parseReadResponse(raw: string): ReadDocument | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(json)) return null;
  const lines: ReadLine[] = [];
  for (const l of Array.isArray(json.lines) ? json.lines : []) {
    if (!isObject(l)) continue;
    const description = text(l.description, 200);
    const quantity = toQuantity(l.quantity);
    if (!description || quantity <= 0) continue;
    lines.push({
      description,
      quantity,
      unit: text(l.unit, 20),
      unitPrice: toCents(l.unitPrice),
      total: toCents(l.total),
      expiresOn: toIsoDate(l.expiresOn),
    });
    if (lines.length === MAX_READ_LINES) break;
  }
  return { supplier: text(json.supplier, 80), document: text(json.document, 80), total: toCents(json.total), lines };
}

/** "Galleta Soda FIELD 34g." → "GALLETA SODA FIELD 34G" */
export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// "34GR" → "34G", "1LT" → "1L": suppliers abbreviate sizes differently.
const SIZE = /^(\d+(?:\.\d+)?)(G|GR|GRS|KG|ML|L|LT|LTS|CC|OZ)$/;
const UNIT_ALIAS: Record<string, string> = { GR: "G", GRS: "G", LT: "L", LTS: "L", CC: "ML" };
const canonical = (t: string) => {
  const m = t.match(SIZE);
  return m ? `${m[1]}${UNIT_ALIAS[m[2]] ?? m[2]}` : t;
};
const tokens = (s: string) =>
  new Set(
    normalizeText(s)
      .split(" ")
      .filter((t) => t.length >= 2)
      .map(canonical),
  );
const sizes = (t: Set<string>) => [...t].filter((x) => SIZE.test(x));

// Share of the product name's words found in the read text. Below this, we don't guess.
export const MATCH_THRESHOLD = 0.6;

// Unit abbreviations on invoices → packaging name prefix. "UNIT" means the base packaging (factor 1).
const UNIT_HINTS: [string[], string][] = [
  [["CJ", "CJA", "CAJ", "CAJA", "BOX"], "CAJA"],
  [["UND", "UN", "U", "UNID", "UNIDAD", "NIU"], "UNIT"],
  [["DSP", "DIS", "DISP", "DISPLAY"], "DISPLAY"],
  [["PQ", "PQT", "PAQ", "PAQUETE"], "PAQUETE"],
  [["FD", "FDO", "FAR", "FARDO"], "FARDO"],
  [["BL", "BLS", "BOL", "BOLSA"], "BOLSA"],
  [["BUL", "BULTO"], "BULTO"],
  [["DOC", "DOCENA"], "DOCENA"],
  [["TIR", "TIRA"], "TIRA"],
  [["PCK", "PACK"], "PACK"],
];

type MatchProduct = { id: string; name: string; packagings: { id: string; name: string; factor: number }[] };
export type LineMatch = { productId: string | null; packagingId: string | null; status: "alias" | "suggested" | "none" };

function packagingFor(p: MatchProduct, unit: string | null) {
  const u = unit ? normalizeText(unit).replace(/ /g, "") : "";
  const hint = UNIT_HINTS.find(([abbr]) => abbr.includes(u))?.[1];
  const byHint =
    hint === "UNIT" ? p.packagings.find((x) => x.factor === 1) : hint ? p.packagings.find((x) => normalizeText(x.name).startsWith(hint)) : undefined;
  return byHint ?? p.packagings.reduce((a, b) => (b.factor > a.factor ? b : a));
}

/** Alias first (exact packaging the owner confirmed before), then word overlap with the product name. */
export function matchLine(line: Pick<ReadLine, "description" | "unit">, products: MatchProduct[], aliases: Record<string, string>): LineMatch {
  const aliased = aliases[normalizeText(line.description)];
  if (aliased) {
    const p = products.find((x) => x.packagings.some((k) => k.id === aliased));
    if (p) return { productId: p.id, packagingId: aliased, status: "alias" };
  }
  const read = tokens(line.description);
  let best: { p: MatchProduct; score: number } | null = null;
  for (const p of products) {
    const name = tokens(p.name);
    if (!name.size) continue;
    // Same product, different size ("Arroz 5KG" vs "Arroz 750g") is a different product.
    const nameSizes = sizes(name);
    const readSizes = sizes(read);
    if (nameSizes.length && readSizes.length && !nameSizes.some((x) => readSizes.includes(x))) continue;
    const score = [...name].filter((t) => read.has(t)).length / name.size;
    if (!best || score > best.score) best = { p, score };
  }
  if (!best || best.score < MATCH_THRESHOLD) return { productId: null, packagingId: null, status: "none" };
  return { productId: best.p.id, packagingId: packagingFor(best.p, line.unit).id, status: "suggested" };
}

/** Cost per packaging in céntimos: the unit price, else total ÷ quantity. */
export const costFromLine = (l: Pick<ReadLine, "unitPrice" | "total" | "quantity">) =>
  l.unitPrice ?? (l.total && l.quantity > 0 ? Math.round(l.total / l.quantity) : null);

/** File type by its first bytes (not the name or the browser's claim): JPEG or PDF, else null. */
export function fileType(b: Uint8Array): "image/jpeg" | "application/pdf" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"; // %PDF
  return null;
}
