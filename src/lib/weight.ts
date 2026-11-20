// Weights are stored in whole grams; people type kilograms.

/** "12.5" | "12,5" | "0.250" → grams. "" → null (no weight). undefined for invalid input. Max 1000 kg. */
export function parseKg(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const m = t.match(/^(\d{1,4})(?:\.(\d{1,3}))?$/);
  if (!m) return undefined;
  const g = Number(m[1]) * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
  return g > 0 && g <= 1_000_000 ? g : undefined;
}

/** 12500 → "12.5 kg" */
export const formatKg = (grams: number) => `${(grams / 1000).toLocaleString("es-PE", { maximumFractionDigits: 3 })} kg`;

/** Weight of a line (quantity × packaging grams), or null when the packaging has no weight. */
export const lineWeight = (l: { quantity: number; weightGrams: number | null }) => (l.weightGrams === null ? null : l.quantity * l.weightGrams);

/** 12500 → "12.5" for inputs. */
export const toKgInput = (grams: number | null) => (grams === null ? "" : String(grams / 1000));
