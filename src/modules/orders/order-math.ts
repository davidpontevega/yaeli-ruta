// Order lines math. Pure: shared by the form (client) and saveOrder (server).
export const MAX_QTY = 10000;

export type Line = { packagingId: string; quantity: number };

export const orderTotal = (lines: { quantity: number; price: number }[]) => lines.reduce((s, l) => s + l.quantity * l.price, 0);

/** Customer's special price for this packaging if it has one (even above the general), else the general price. */
export function priceFor(p: { id: string; salePrice: number }, special: Record<string, number>): { price: number; special: boolean } {
  const s = special[p.id];
  return s === undefined ? { price: p.salePrice, special: false } : { price: s, special: true };
}

/** Adds a line; the same packaging adds to the existing quantity (capped). */
export function mergeLine<L extends Line>(lines: L[], line: L): L[] {
  const i = lines.findIndex((l) => l.packagingId === line.packagingId);
  if (i < 0) return [...lines, line];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l));
}

/** Base units still free: stock minus what other pending orders hold. Never negative. */
export const available = (stockBase: number, reservedBase: number) => Math.max(0, stockBase - reservedBase);

/** Biggest packaging with a price (a distributor sells by box); falls back to the biggest. */
export function defaultPackaging<P extends { factor: number; salePrice: number }>(packagings: P[]): P | undefined {
  const byFactor = [...packagings].sort((a, b) => b.factor - a.factor);
  return byFactor.find((p) => p.salePrice > 0) ?? byFactor[0];
}
