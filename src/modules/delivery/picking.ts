// Picking list of a delivery sheet: what to take from each warehouse floor (FEFO). Pure.
import { fefoPick, type StockLot } from "@/lib/fefo";
import { lineWeight } from "@/lib/weight";

export type PickingLine = { productId: string; productName: string; quantity: number; factor: number; weightGrams: number | null };
export type PickingItem = { productId: string; productName: string; expiresOn: string | null; baseQty: number };
export type Picking = {
  floors: { locationId: string; locationName: string; items: PickingItem[] }[];
  short: { productId: string; productName: string; missing: number }[];
  weight: { grams: number; noWeight: number };
};

/** Sums the order lines per product (base units), picks FEFO from `lots`, and groups by floor → product, both by name. Short stock: picks what there is. */
export function buildPicking(lines: PickingLine[], lots: (StockLot & { productId: string })[]): Picking {
  const need = new Map<string, { name: string; qty: number }>();
  let grams = 0;
  let noWeight = 0;
  for (const l of lines) {
    const p = need.get(l.productId) ?? { name: l.productName, qty: 0 };
    p.qty += l.quantity * l.factor;
    need.set(l.productId, p);
    const w = lineWeight(l);
    if (w === null) noWeight++;
    else grams += w;
  }

  const floors = new Map<string, Picking["floors"][number]>();
  const short: Picking["short"] = [];
  for (const [productId, p] of need) {
    const mine = lots.filter((l) => l.productId === productId && l.quantity > 0);
    const have = mine.reduce((s, l) => s + l.quantity, 0);
    if (have < p.qty) short.push({ productId, productName: p.name, missing: p.qty - have });
    for (const take of fefoPick(mine, Math.min(have, p.qty)) ?? []) {
      const lot = mine.find((l) => l.lotId === take.lotId && l.locationId === take.locationId)!;
      const floor = floors.get(lot.locationId) ?? { locationId: lot.locationId, locationName: lot.locationName, items: [] };
      floor.items.push({ productId, productName: p.name, expiresOn: lot.expiresOn, baseQty: take.quantity });
      floors.set(lot.locationId, floor);
    }
  }

  const byName = (a: string, b: string) => a.localeCompare(b, "es");
  const sorted = [...floors.values()].sort((a, b) => byName(a.locationName, b.locationName));
  for (const f of sorted)
    f.items.sort((a, b) => byName(a.productName, b.productName) || (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
  return { floors: sorted, short: short.sort((a, b) => byName(a.productName, b.productName)), weight: { grams, noWeight } };
}
