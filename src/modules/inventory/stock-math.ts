export const toBaseUnits = (qty: number, factor: number) => qty * factor;

/**
 * New average cost per base unit (céntimos, rounded) after receiving `inQty` at `inUnitCost`.
 * `inUnitCost` may be fractional (box price / factor) so rounding happens once, here.
 */
export function weightedAverageCost(stockQty: number, avgCost: number, inQty: number, inUnitCost: number): number {
  if (stockQty <= 0) return Math.round(inUnitCost);
  return Math.round((stockQty * avgCost + inQty * inUnitCost) / (stockQty + inQty));
}

/** 197 units with caja×96 → [{caja,2},{unidad,5}]. Largest packaging first; zero counts skipped. */
export function splitByPackaging(baseQty: number, packagings: { name: string; factor: number }[]) {
  const out: { name: string; count: number }[] = [];
  let rest = baseQty;
  for (const p of [...packagings].sort((a, b) => b.factor - a.factor)) {
    const count = Math.floor(rest / p.factor);
    if (count > 0) out.push({ name: p.name, count });
    rest -= count * p.factor;
  }
  return out;
}
