// Suggested sale price from cost and margin. Pure. Money in céntimos.

const ROUND_TO = 10; // céntimos: prices end in .x0

/** Cost per base unit used for pricing: last cost (price follows the supplier), else average, else none. */
export const priceUnitCost = (lastCost: number, averageCost: number): number | null =>
  lastCost > 0 ? lastCost : averageCost > 0 ? averageCost : null;

/** cost × factor × (1 + margin%), rounded UP to 10 céntimos. null without cost. */
export function suggestedPrice(unitCost: number | null, factor: number, marginPct: number): number | null {
  if (!unitCost) return null;
  const raw = (unitCost * factor * (100 + marginPct)) / 100;
  return Math.ceil(Math.round(raw * 1000) / 1000 / ROUND_TO) * ROUND_TO; // tolerate float noise before rounding up
}

/** Margin over cost, in whole %. null without cost. */
export function realMarginPct(price: number, unitCost: number | null, factor: number): number | null {
  if (!unitCost) return null;
  const cost = unitCost * factor;
  return Math.round(((price - cost) * 100) / cost);
}

// Cost per unit is rounded to céntimos (a S/ 60 box of 96 → 63 c/u), so a correct price can look a hair below target.
const MARGIN_TOLERANCE_PCT = 1;

/** True when the price misses the target margin by more than the tolerance (a real cost rise, not rounding noise). */
export function needsReview(price: number, unitCost: number | null, factor: number, marginPct: number): boolean {
  if (!unitCost) return false;
  return price * 100 < unitCost * factor * (100 + marginPct - MARGIN_TOLERANCE_PCT);
}
