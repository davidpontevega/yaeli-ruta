// First-expired-first-out pick. Pure.
export type StockLot = { lotId: string; locationId: string; locationName: string; expiresOn: string | null; quantity: number };

/** Takes `qty` base units from the lots expiring first (no date last), then by location name. null when stock is short. */
export function fefoPick(lots: StockLot[], qty: number): { lotId: string; locationId: string; quantity: number }[] | null {
  const sorted = lots
    .filter((l) => l.quantity > 0)
    .sort((a, b) => (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") || a.locationName.localeCompare(b.locationName));
  const out: { lotId: string; locationId: string; quantity: number }[] = [];
  let rest = qty;
  for (const l of sorted) {
    if (rest <= 0) break;
    const take = Math.min(rest, l.quantity);
    out.push({ lotId: l.lotId, locationId: l.locationId, quantity: take });
    rest -= take;
  }
  return rest > 0 ? null : out;
}
