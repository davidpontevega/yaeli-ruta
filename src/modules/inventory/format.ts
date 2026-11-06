import { splitByPackaging } from "./stock-math";

/** "2027-03-31" → "31/03/2027" */
export const formatDate = (iso: string) => iso.split("-").reverse().join("/");

/** 197 with caja×96 → "2 caja + 5 unidad" */
export const formatQty = (qty: number, packagings: { name: string; factor: number }[]) =>
  splitByPackaging(qty, packagings)
    .map((x) => `${x.count} ${x.name}`)
    .join(" + ");
