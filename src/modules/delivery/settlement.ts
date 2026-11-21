// Settlement of a delivery sheet. Pure.

type Line = { lotId: string; locationId: string; quantity: number };

/**
 * What goes back from the vehicle: per lot, what is left on it fills the floors it came from (net out of each floor, in `locationId` order).
 * Anything beyond what the sheet took out stays on the vehicle. Zero lines are omitted.
 */
export function returnPlan(vehicle: { lotId: string; quantity: number }[], origins: Line[]): Line[] {
  const left = new Map<string, number>();
  for (const v of vehicle) left.set(v.lotId, (left.get(v.lotId) ?? 0) + v.quantity);
  const out: Line[] = [];
  for (const o of [...origins].sort((a, b) => a.lotId.localeCompare(b.lotId) || a.locationId.localeCompare(b.locationId))) {
    const rest = left.get(o.lotId) ?? 0;
    const quantity = Math.min(rest, o.quantity);
    if (quantity <= 0) continue;
    left.set(o.lotId, rest - quantity);
    out.push({ lotId: o.lotId, locationId: o.locationId, quantity });
  }
  return out;
}
