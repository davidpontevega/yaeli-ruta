// Purchase list math. Pure, shared by the form (client) and the server. Money in céntimos, weight in grams.

export type PurchaseLine = { quantity: number; cost: number; freight: number; weightGrams: number | null };

/** Weight of a line, or null when the packaging has no weight. */
export const lineWeight = (l: { quantity: number; weightGrams: number | null }) => (l.weightGrams === null ? null : l.quantity * l.weightGrams);

/** Goods (cost × qty), freight, total, known weight and how many lines have no weight. */
export function purchaseTotals(lines: PurchaseLine[]) {
  let goods = 0;
  let freight = 0;
  let weight = 0;
  let noWeight = 0;
  for (const l of lines) {
    goods += l.quantity * l.cost;
    freight += l.freight;
    const w = lineWeight(l);
    if (w === null) noWeight++;
    else weight += w;
  }
  return { goods, freight, total: goods + freight, weight, noWeight };
}

/** Cost per packaging once the line's freight is spread over its quantity (rounded to the céntimo). */
export const landedUnitCost = (cost: number, freight: number, quantity: number) => cost + Math.round(freight / quantity);

/** Packagings to buy to reach the minimum (base units), rounded up; an out-of-stock product without minimum gets 1. 0 = nothing missing. */
export function missingToOrder(total: number, minStock: number, factor: number): number {
  if (total < minStock) return Math.ceil((minStock - total) / factor);
  return total <= 0 ? 1 : 0;
}
