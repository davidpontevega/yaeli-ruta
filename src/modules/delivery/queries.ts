import "server-only";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/server/db";
import {
  accountMovements,
  customers,
  deliverySheets,
  locations,
  lots,
  orderItems,
  orders,
  packagings,
  products,
  routes,
  stockLevels,
  stockMovements,
  users,
  type Role,
} from "@/server/db/schema";
import { locationLots, warehouseLots } from "@/modules/inventory";
import { balancesByCustomer } from "@/modules/accounts";
import { buildPicking } from "./picking";
import { buildRouteSnapshot, type RouteSnapshot } from "./route-snapshot";

const pending = eq(orders.status, "PENDIENTE");

/** Sheets of a date with route, vehicle, pending orders and their total (céntimos). */
export function listSheets(date: string) {
  return db
    .select({
      id: deliverySheets.id,
      number: deliverySheets.number,
      status: deliverySheets.status,
      routeName: routes.name,
      vehicleName: locations.name,
      orders: count(orders.id),
      total: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
    })
    .from(deliverySheets)
    .innerJoin(routes, eq(routes.id, deliverySheets.routeId))
    .innerJoin(locations, eq(locations.id, deliverySheets.vehicleId))
    .leftJoin(orders, and(eq(orders.sheetId, deliverySheets.id), pending))
    .where(eq(deliverySheets.date, date))
    .groupBy(deliverySheets.id, routes.id, locations.id)
    .orderBy(asc(routes.name), asc(deliverySheets.number));
}
export type SheetRow = Awaited<ReturnType<typeof listSheets>>[number];

/** Pending orders matching `where`, in visit order: customer, number, lines and total. */
const orderRows = (where: ReturnType<typeof and>) =>
  db
    .select({
      id: orders.id,
      number: orders.number,
      total: orders.total,
      deliveryOn: orders.deliveryOn,
      sheetNumber: sql<number | null>`(select numero from hojas_ruta where id = ${orders.sheetId})`,
      customerName: customers.name,
      lines: count(orderItems.id),
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(pending, where))
    .groupBy(orders.id, customers.id)
    .orderBy(asc(customers.routeOrder), asc(orders.number));
export type SheetOrder = Awaited<ReturnType<typeof orderRows>>[number];

/** Header (with the vehicle capacity), its pending orders, and the candidates: pending orders of the route, any date, in no sheet or in another sheet still PREPARANDO. */
export async function getSheet(id: string) {
  const [sheet] = await db
    .select({
      id: deliverySheets.id,
      number: deliverySheets.number,
      date: deliverySheets.date,
      status: deliverySheets.status,
      routeName: routes.name,
      routeId: routes.id,
      vehicleName: locations.name,
      capacityKg: locations.capacityKg,
      driverId: deliverySheets.driverId,
    })
    .from(deliverySheets)
    .innerJoin(routes, eq(routes.id, deliverySheets.routeId))
    .innerJoin(locations, eq(locations.id, deliverySheets.vehicleId))
    .where(eq(deliverySheets.id, id));
  if (!sheet) return null;
  const [inSheet, candidates] = await Promise.all([
    orderRows(eq(orders.sheetId, id)),
    orderRows(
      and(
        eq(customers.routeId, sheet.routeId),
        or(
          isNull(orders.sheetId),
          and(
            ne(orders.sheetId, id),
            inArray(orders.sheetId, db.select({ id: deliverySheets.id }).from(deliverySheets).where(eq(deliverySheets.status, "PREPARANDO"))),
          ),
        ),
      ),
    ),
  ]);
  return { ...sheet, orders: inSheet, candidates };
}
export type SheetDetail = NonNullable<Awaited<ReturnType<typeof getSheet>>>;

/** Lines of the sheet's pending orders, for `buildPicking`. `q` = a transaction to read inside it. */
export function sheetLines(sheetId: string, q: Tx | typeof db = db) {
  return q
    .select({
      productId: packagings.productId,
      productName: products.name,
      quantity: orderItems.quantity,
      factor: packagings.factor,
      weightGrams: packagings.weightGrams,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(packagings, eq(packagings.id, orderItems.packagingId))
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(and(eq(orders.sheetId, sheetId), pending));
}

/**
 * PREPARANDO: picking of the sheet's pending orders from the warehouse floors. EN_RUTA: the same lines over the vehicle's lots (its load).
 * Plus each product's packagings to show quantities.
 */
export async function getPicking(sheetId: string) {
  const [[sheet], lines] = await Promise.all([
    db.select({ status: deliverySheets.status, vehicleId: deliverySheets.vehicleId }).from(deliverySheets).where(eq(deliverySheets.id, sheetId)),
    sheetLines(sheetId),
  ]);
  const status = sheet?.status ?? "PREPARANDO";
  const ids = [...new Set(lines.map((l) => l.productId))];
  const [stock, packs] = await Promise.all([status === "EN_RUTA" ? locationLots(sheet.vehicleId) : warehouseLots(ids), packagingsOf(ids)]);
  return { ...buildPicking(lines, stock), status, packagings: packs };
}
export type SheetPicking = Awaited<ReturnType<typeof getPicking>>;

/** Packagings of these products grouped by product, to show quantities with `formatQty`. */
async function packagingsOf(ids: string[]) {
  const packs = ids.length
    ? await db
        .select({ productId: packagings.productId, name: packagings.name, factor: packagings.factor })
        .from(packagings)
        .where(inArray(packagings.productId, ids))
    : [];
  // Spread: Object.groupBy gives a null-prototype object, which can't be passed to a Client Component.
  return { ...Object.groupBy(packs, (p) => p.productId) };
}

/** Net TRASLADO of the sheet per (lot, floor) still out of that floor (quantity > 0), with its product. In lot, floor order. */
export function sheetOrigins(sheetId: string, q: Tx | typeof db = db) {
  return q
    .select({
      lotId: stockMovements.lotId,
      locationId: stockMovements.locationId,
      productId: lots.productId,
      quantity: sql`-sum(${stockMovements.quantity})`.mapWith(Number),
    })
    .from(stockMovements)
    .innerJoin(lots, eq(lots.id, stockMovements.lotId))
    .where(and(eq(stockMovements.documentId, sheetId), eq(stockMovements.type, "TRASLADO")))
    .groupBy(stockMovements.lotId, stockMovements.locationId, lots.productId)
    .having(lt(sql`sum(${stockMovements.quantity})`, 0))
    .orderBy(asc(stockMovements.lotId), asc(stockMovements.locationId));
}

/** Cash expected from a sheet: its EFECTIVO payments (céntimos). `q` = a transaction to read inside it. */
export async function sheetPayments(sheetId: string, q: Tx | typeof db = db) {
  const byMethod = await q
    .select({ method: accountMovements.method, amount: sql`-sum(${accountMovements.amount})`.mapWith(Number) })
    .from(accountMovements)
    .where(and(eq(accountMovements.sheetId, sheetId), eq(accountMovements.type, "ABONO"), isNotNull(accountMovements.method)))
    .groupBy(accountMovements.method)
    .orderBy(asc(accountMovements.method));
  return { byMethod, expected: byMethod.find((m) => m.method === "EFECTIVO")?.amount ?? 0 };
}

/** Settlement of a sheet: delivered orders, payments taken on the road by method, cash expected, and (EN_RUTA) what is on the vehicle. */
export async function getSettlement(sheetId: string) {
  const [[sheet], delivered, { byMethod, expected }] = await Promise.all([
    db
      .select({
        status: deliverySheets.status,
        vehicleId: deliverySheets.vehicleId,
        expectedCash: deliverySheets.expectedCash,
        declaredCash: deliverySheets.declaredCash,
        settledAt: deliverySheets.settledAt,
      })
      .from(deliverySheets)
      .where(eq(deliverySheets.id, sheetId)),
    db
      .select({ id: orders.id, number: orders.number, customerName: customers.name, total: orders.total })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.sheetId, sheetId), eq(orders.status, "ENTREGADO")))
      .orderBy(asc(customers.routeOrder), asc(orders.number)),
    sheetPayments(sheetId),
  ]);
  const leftovers =
    sheet?.status === "EN_RUTA"
      ? await db
          .select({ productId: products.id, productName: products.name, baseQty: sql`sum(${stockLevels.quantity})`.mapWith(Number) })
          .from(stockLevels)
          .innerJoin(lots, eq(lots.id, stockLevels.lotId))
          .innerJoin(products, eq(products.id, lots.productId))
          .where(and(eq(stockLevels.locationId, sheet.vehicleId), gt(stockLevels.quantity, 0)))
          .groupBy(products.id)
          .orderBy(asc(products.name))
      : [];
  return {
    delivered,
    byMethod,
    expected,
    leftovers,
    packagings: await packagingsOf(leftovers.map((l) => l.productId)),
    expectedCash: sheet?.expectedCash ?? null,
    declaredCash: sheet?.declaredCash ?? null,
    settledAt: sheet?.settledAt ?? null,
  };
}
export type Settlement = Awaited<ReturnType<typeof getSettlement>>;

/** Active REPARTIDOR users, to choose who delivers a sheet. */
export function listDrivers() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "REPARTIDOR"), eq(users.active, true)))
    .orderBy(asc(users.name));
}

const drivers = alias(users, "repartidores");

/**
 * Sheets for the phone: EN_RUTA (any date) or PREPARANDO of `today`, never LIQUIDADA. A REPARTIDOR only gets the sheets assigned to him.
 * Customers in visit order with their current debt, their non-cancelled orders with lines (sale price), and the load summary.
 */
export async function getMyRoute(user: { id: string; role: Role }, today: string): Promise<RouteSnapshot["sheets"]> {
  const rows = await db
    .select({
      sheetId: deliverySheets.id,
      sheetNumber: deliverySheets.number,
      sheetStatus: deliverySheets.status,
      sheetDate: deliverySheets.date,
      routeName: routes.name,
      vehicleName: locations.name,
      driverName: drivers.name,
      customerId: customers.id,
      customerName: customers.name,
      phone: customers.phone,
      address: customers.address,
      reference: customers.reference,
      routeOrder: customers.routeOrder,
      orderId: orders.id,
      orderNumber: orders.number,
      orderStatus: orders.status,
      orderTotal: orders.total,
      productName: products.name,
      packagingName: packagings.name,
      quantity: orderItems.quantity,
      price: orderItems.price,
    })
    .from(deliverySheets)
    .innerJoin(routes, eq(routes.id, deliverySheets.routeId))
    .innerJoin(locations, eq(locations.id, deliverySheets.vehicleId))
    .leftJoin(drivers, eq(drivers.id, deliverySheets.driverId))
    .leftJoin(orders, and(eq(orders.sheetId, deliverySheets.id), ne(orders.status, "ANULADO")))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(packagings, eq(packagings.id, orderItems.packagingId))
    .leftJoin(products, eq(products.id, packagings.productId))
    .where(
      and(
        or(eq(deliverySheets.status, "EN_RUTA"), and(eq(deliverySheets.status, "PREPARANDO"), eq(deliverySheets.date, today))),
        user.role === "DUENO" ? undefined : eq(deliverySheets.driverId, user.id),
      ),
    )
    .orderBy(asc(routes.name), asc(deliverySheets.number), asc(products.name));
  const sheetIds = [...new Set(rows.map((r) => r.sheetId))];
  const customerIds = [...new Set(rows.flatMap((r) => (r.customerId ? [r.customerId] : [])))];
  // One getPicking per sheet: 1–2 sheets a day.
  const [balances, pickings] = await Promise.all([balancesByCustomer(customerIds), Promise.all(sheetIds.map((id) => getPicking(id)))]);
  return buildRouteSnapshot(
    rows,
    balances,
    Object.fromEntries(sheetIds.map((id, i) => [id, pickings[i]])),
    Object.assign({}, ...pickings.map((p) => p.packagings)),
  );
}
