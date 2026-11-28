// What a phone keeps of today's sheets to read without signal. Pure.
// Every output object is built field by field (allowlist): costs and margins never reach the phone even if a row carries them.
import { formatQty } from "@/lib/quantity";
import type { Picking } from "./picking";

/** One row per order line (order and customer null for a sheet without orders), in any order. */
export type RouteRow = {
  sheetId: string;
  sheetNumber: number;
  sheetStatus: "PREPARANDO" | "EN_RUTA" | "LIQUIDADA";
  sheetDate: string;
  routeName: string;
  vehicleName: string;
  driverName: string | null;
  customerId: string | null;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  reference: string | null;
  routeOrder: number | null;
  orderId: string | null;
  orderNumber: number | null;
  orderStatus: "PENDIENTE" | "ANULADO" | "ENTREGADO" | null;
  orderTotal: number | null;
  productName: string | null;
  packagingName: string | null;
  quantity: number | null;
  price: number | null;
};

type Packs = Record<string, { name: string; factor: number }[] | undefined>;

export type RouteOrder = {
  id: string;
  number: number;
  status: "PENDIENTE" | "ENTREGADO";
  total: number;
  lines: { product: string; packaging: string; quantity: number; price: number }[];
};
export type RouteCustomer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  reference: string | null;
  debt: number;
  orders: RouteOrder[];
};
export type RouteSheet = {
  id: string;
  number: number;
  status: RouteRow["sheetStatus"];
  date: string;
  routeName: string;
  vehicleName: string;
  driverName: string | null;
  customers: RouteCustomer[];
  load: {
    items: { product: string; qty: string; expiresOn: string | null }[];
    short: { product: string; missing: string }[];
    weightGrams: number;
    noWeight: number;
  };
};
export type RouteSnapshot = { userId: string; downloadedAt: string; sheets: RouteSheet[] };

const noLoad: Picking = { floors: [], short: [], weight: { grams: 0, noWeight: 0 } };

/** Load summary of a sheet: one line per product and expiry (all floors together), shortages and weight. */
function summarizeLoad(p: Picking, packs: Packs): RouteSheet["load"] {
  const byLot = new Map<string, { productId: string; product: string; expiresOn: string | null; baseQty: number }>();
  for (const f of p.floors)
    for (const i of f.items) {
      const k = `${i.productId}|${i.expiresOn}`;
      const x = byLot.get(k) ?? { productId: i.productId, product: i.productName, expiresOn: i.expiresOn, baseQty: 0 };
      x.baseQty += i.baseQty;
      byLot.set(k, x);
    }
  const items = [...byLot.values()]
    .sort((a, b) => a.product.localeCompare(b.product, "es") || (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"))
    .map((x) => ({ product: x.product, qty: formatQty(x.baseQty, packs[x.productId] ?? []), expiresOn: x.expiresOn }));
  const short = p.short.map((s) => ({ product: s.productName, missing: formatQty(s.missing, packs[s.productId] ?? []) }));
  return { items, short, weightGrams: p.weight.grams, noWeight: p.weight.noWeight };
}

/** Groups rows by sheet → customer (visit order) → order (by number) → lines. Cancelled orders are left out; debt defaults to 0. */
export function buildRouteSnapshot(
  rows: RouteRow[],
  balances: Record<string, number>,
  pickings: Record<string, Picking | undefined>,
  packs: Packs,
): RouteSheet[] {
  const sheets = new Map<string, RouteSheet>();
  const visit = new Map<string, number>();
  for (const r of rows) {
    let s = sheets.get(r.sheetId);
    if (!s) {
      s = {
        id: r.sheetId,
        number: r.sheetNumber,
        status: r.sheetStatus,
        date: r.sheetDate,
        routeName: r.routeName,
        vehicleName: r.vehicleName,
        driverName: r.driverName,
        customers: [],
        load: summarizeLoad(pickings[r.sheetId] ?? noLoad, packs),
      };
      sheets.set(r.sheetId, s);
    }
    if (!r.customerId || !r.orderId || r.orderStatus === null || r.orderStatus === "ANULADO") continue;
    let c = s.customers.find((x) => x.id === r.customerId);
    if (!c) {
      c = {
        id: r.customerId,
        name: r.customerName ?? "",
        phone: r.phone,
        address: r.address,
        reference: r.reference,
        debt: balances[r.customerId] ?? 0,
        orders: [],
      };
      s.customers.push(c);
      visit.set(r.customerId, r.routeOrder ?? Number.MAX_SAFE_INTEGER);
    }
    let o = c.orders.find((x) => x.id === r.orderId);
    if (!o) {
      o = { id: r.orderId, number: r.orderNumber ?? 0, status: r.orderStatus, total: r.orderTotal ?? 0, lines: [] };
      c.orders.push(o);
    }
    if (r.productName && r.packagingName && r.quantity !== null && r.price !== null)
      o.lines.push({ product: r.productName, packaging: r.packagingName, quantity: r.quantity, price: r.price });
  }
  for (const s of sheets.values()) {
    s.customers.sort((a, b) => visit.get(a.id)! - visit.get(b.id)! || a.name.localeCompare(b.name, "es"));
    for (const c of s.customers) c.orders.sort((a, b) => a.number - b.number);
  }
  return [...sheets.values()];
}
