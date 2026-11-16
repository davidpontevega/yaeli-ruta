// Quantities in base units shown as packagings ("2 caja + 5 unidad"). Pure; used by inventory and orders.

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

/** 197 with caja×96 → "2 caja + 5 unidad" */
export const formatQty = (qty: number, packagings: { name: string; factor: number }[]) =>
  splitByPackaging(qty, packagings)
    .map((x) => `${x.count} ${x.name}`)
    .join(" + ");
