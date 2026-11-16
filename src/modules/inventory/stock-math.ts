export const toBaseUnits = (qty: number, factor: number) => qty * factor;

/**
 * New average cost per base unit (céntimos, rounded) after receiving `inQty` at `inUnitCost`.
 * `inUnitCost` may be fractional (box price / factor) so rounding happens once, here.
 */
export function weightedAverageCost(stockQty: number, avgCost: number, inQty: number, inUnitCost: number): number {
  if (stockQty <= 0) return Math.round(inUnitCost);
  return Math.round((stockQty * avgCost + inQty * inUnitCost) / (stockQty + inQty));
}
