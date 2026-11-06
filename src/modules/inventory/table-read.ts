// Builds the product table of a supplier document from positioned words (PDF text layer or OCR). Pure: no DOM, no DB.
// Adapted from Farmacia's src/lib/ocr/layout.ts (lines by height, columns from the header labels).
import { MAX_READ_LINES, toCents, toIsoDate, type ReadDocument, type ReadLine } from "./document-read";

/** Coordinates grow to the right and DOWN (image convention). */
export type Word = { text: string; x0: number; x1: number; y0: number; y1: number };

const center = (w: Word) => (w.y0 + w.y1) / 2;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

/** A PDF text item is often a whole phrase or row: split it into words, placing each by its character offset. */
export function splitItem(text: string, x0: number, x1: number, y0: number, y1: number): Word[] {
  const perChar = text.length ? (x1 - x0) / text.length : 0;
  return [...text.matchAll(/\S+/g)].map((m) => ({ text: m[0], x0: x0 + m.index * perChar, x1: x0 + (m.index + m[0].length) * perChar, y0, y1 }));
}

/** Groups words into lines by the height of their center, each line sorted left to right. */
export function groupLines(words: Word[]): Word[][] {
  const tol = Math.max(median(words.map((w) => w.y1 - w.y0)) * 0.6, 2);
  const lines: { cy: number; words: Word[] }[] = [];
  for (const w of [...words].sort((a, b) => center(a) - center(b))) {
    const line = lines.find((l) => Math.abs(l.cy - center(w)) < tol);
    if (line) {
      line.words.push(w);
      line.cy = line.words.reduce((s, x) => s + center(x), 0) / line.words.length;
    } else lines.push({ cy: center(w), words: [w] });
  }
  return lines.map((l) => l.words.sort((a, b) => a.x0 - b.x0));
}

type Column = "qty" | "unit" | "desc" | "price" | "amount" | "expiry";

// Normalized label (letters only) → column. Price "with IGV" (P.UNIT, PRECIO) beats "without IGV" (V.UNIT, VALOR UNIT).
const LABELS: { column: Column; match: (w: string) => boolean; priority?: number }[] = [
  { column: "qty", match: (w) => w.startsWith("CANT") },
  { column: "unit", match: (w) => ["UM", "UND", "UNID", "UNIDAD", "MEDIDA", "UMEDIDA"].includes(w) },
  { column: "desc", match: (w) => ["DESCRIP", "DETALLE", "PRODUCTO", "ARTICULO"].some((p) => w.startsWith(p)) },
  { column: "price", match: (w) => ["PUNIT", "PRECIO", "PU", "PRECIOUNIT", "PUNITARIO"].includes(w) || w.startsWith("PRECIOUNIT"), priority: 2 },
  { column: "price", match: (w) => ["VUNIT", "VALORUNIT", "VUNITARIO", "VALORUNITARIO"].includes(w), priority: 1 },
  { column: "amount", match: (w) => ["IMPORTE", "TOTAL", "SUBTOTAL", "VALORVENTA", "VVENTA"].includes(w) },
  { column: "expiry", match: (w) => ["VCTO", "VENCE", "VENC", "FV", "EXP", "VENCIMIENTO", "FVENC"].includes(w) },
];
const labelOf = (w: string) => LABELS.find((l) => l.match(w));

export type TableHeader = { lineIndex: number; columns: Partial<Record<Column, [number, number]>> };

/** The line with most known labels; needs quantity, description and (price or amount). Columns start just before each label. */
export function findTableHeader(lines: Word[][]): TableHeader | null {
  let best: { lineIndex: number; hits: { column: Column; x0: number; priority: number }[] } | null = null;
  lines.forEach((line, lineIndex) => {
    const hits: { column: Column; x0: number; priority: number }[] = [];
    for (let i = 0; i < line.length; i++) {
      // Two-word labels ("VALOR UNIT", "VALOR VENTA") only when the word alone isn't a label.
      const single = labelOf(norm(line[i].text));
      const pair = !single && i + 1 < line.length ? labelOf(norm(line[i].text + line[i + 1].text)) : undefined;
      const label = single ?? pair;
      if (!label) continue;
      hits.push({ column: label.column, x0: line[i].x0, priority: label.priority ?? 0 });
      if (pair) i++;
    }
    const kinds = new Set(hits.map((h) => h.column));
    if (!best || kinds.size > new Set(best.hits.map((h) => h.column)).size) best = { lineIndex, hits };
  });
  if (!best) return null;
  const { lineIndex, hits } = best as { lineIndex: number; hits: { column: Column; x0: number; priority: number }[] };
  const kinds = new Set(hits.map((h) => h.column));
  if (!kinds.has("qty") || !kinds.has("desc") || !(kinds.has("price") || kinds.has("amount"))) return null;

  const charWidth = median(lines[lineIndex].map((w) => (w.x1 - w.x0) / Math.max(1, w.text.length))) || 5;
  const sorted = [...hits].sort((a, b) => a.x0 - b.x0);
  const columns: TableHeader["columns"] = {};
  const chosen = new Map<Column, number>(); // best priority seen per column
  sorted.forEach((h, i) => {
    const left = i === 0 ? -Infinity : h.x0 - charWidth;
    const right = i === sorted.length - 1 ? Infinity : sorted[i + 1].x0 - charWidth;
    // Repeated column (two prices, or "TOTAL" twice): keep the higher priority, else the rightmost.
    // ponytail: a dropped repeated column leaves its span unassigned, and right-aligned numbers wider than their label can
    // fall into the previous column. Fine for the formats seen; per-supplier column templates if a real invoice fails.
    if (chosen.has(h.column) && chosen.get(h.column)! > h.priority) return;
    chosen.set(h.column, h.priority);
    columns[h.column] = [left, right];
  });
  return { lineIndex, columns };
}

// Footer labels compared as whole words, so a description like "SONDA..." or "TOTALMENTE..." doesn't end the table.
const FOOTER_1 = ["SON", "IGV", "TOTAL", "SUBTOTAL"];
const FOOTER_2 = ["OPGRAVADA", "SUBTOTAL", "IMPORTETOTAL", "OPEXONERADA", "OPINAFECTA", "TOTALAPAGAR", "OPGRATUITA"];
const isFooter = (line: Word[]) =>
  FOOTER_1.includes(norm(line[0]?.text ?? "")) || FOOTER_2.includes(norm((line[0]?.text ?? "") + (line[1]?.text ?? "")));

/** Quantity cell → whole number. "2", "2.00", "2,000" (Peruvian e-invoices print decimals) → 2. "1.5" → 0 so the user fixes it. */
export function parseQuantity(cell: string): number {
  const m = cell.replace(/[^\d.,]/g, "").match(/^(\d+)(?:[.,]0+)?$/);
  return m ? Number(m[1]) : 0;
}

function cells(line: Word[], columns: TableHeader["columns"]) {
  const out: Partial<Record<Column, string>> = {};
  for (const w of line) {
    const c = (w.x0 + w.x1) / 2;
    const col = (Object.keys(columns) as Column[]).find((k) => c >= columns[k]![0] && c < columns[k]![1]);
    if (col) out[col] = out[col] ? `${out[col]} ${w.text}` : w.text;
  }
  return out;
}

const EXPIRY_IN_TEXT = /\b(?:VCTO|VENCE|VENC|F\.?\s?V\.?|EXP)\.?:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;

/**
 * Rows of one page under `header`. A line with only description text continues the previous row
 * (so on a continuation page, `lineIndex: -1`, letterhead lines before the first row are ignored).
 * `ended`: the footer was reached; later pages without their own header are not part of the table.
 */
export function tableRows(lines: Word[][], header: TableHeader): { rows: ReadLine[]; ended: boolean } {
  const rows: ReadLine[] = [];
  for (const line of lines.slice(header.lineIndex + 1)) {
    const t = cells(line, header.columns);
    if (!/\d/.test(t.qty ?? "") && isFooter(line)) return { rows, ended: true }; // footer text may fall in the quantity column
    if (t.qty && /\d/.test(t.qty) && t.desc) {
      rows.push({
        description: t.desc.slice(0, 200),
        quantity: parseQuantity(t.qty), // 0 = unreadable: the form makes the user fix it
        unit: t.unit?.slice(0, 20) ?? null,
        unitPrice: toCents(t.price),
        total: toCents(t.amount),
        expiresOn: toIsoDate(t.expiry) ?? toIsoDate(t.desc.match(EXPIRY_IN_TEXT)?.[1]),
      });
    } else if (!t.qty && !t.price && !t.amount && t.desc && rows.length) {
      const last = rows[rows.length - 1];
      last.description = `${last.description} ${t.desc}`.slice(0, 200);
    }
  }
  return { rows, ended: false };
}

const lastAmount = (line: string) => {
  const m = line.match(/\d[\d.,]*[.,]\d{2}(?!.*\d)/);
  return m ? toCents(m[0]) : null;
};

/** Supplier, document number and total from the page text (lines joined by "\n"). */
export function documentInfo(text: string): Pick<ReadDocument, "supplier" | "document" | "total"> {
  const lines = text.split("\n").map((l) => l.trim());
  const document = text.match(/\b([FBET][A-Z0-9]{3}\s?-\s?\d{1,8})\b/)?.[1].replace(/\s/g, "") ?? null;
  const supplierLine = lines.find((l) => /(?:^|\s)(S\.?A\.?C\.?|S\.?A\.|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?)(?!\w)/i.test(l));
  const supplier =
    supplierLine
      ?.replace(/\s+RUC\b.*$/i, "")
      .trim()
      .slice(0, 80) || null;
  const totalLine =
    lines.find((l) => /IMPORTE\s+TOTAL|TOTAL\s+A\s+PAGAR/i.test(l)) ??
    [...lines].reverse().find((l) => /^TOTAL\b/i.test(l) && !/SUB\s?TOTAL/i.test(l));
  return { supplier, document, total: totalLine ? lastAmount(totalLine) : null };
}

/** Pages of positioned words → document, or null when no table header is found on any page. */
export function linesToDocument(pages: Word[][], text: string): ReadDocument | null {
  const lines: ReadLine[] = [];
  let header: TableHeader | null = null;
  let ended = false;
  for (const words of pages) {
    const pageLines = groupLines(words);
    const own = findTableHeader(pageLines);
    if (ended && !own) break; // table already closed by its footer
    // A continuation page without its own header reuses the previous columns.
    const h = own ?? (header ? { ...header, lineIndex: -1 } : null);
    if (!h) continue;
    header = own ?? header;
    const page = tableRows(pageLines, h);
    lines.push(...page.rows);
    ended = page.ended;
  }
  if (!header) return null;
  return { ...documentInfo(text), lines: lines.slice(0, MAX_READ_LINES) };
}
