import "server-only";
import { and, asc, count, desc, eq, gte, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { customers, deliverySheets, orderItems, orders, packagings, products, routes } from "@/server/db/schema";
import { todayInLima, stockByProduct } from "@/modules/inventory";
import { available } from "./order-math";

/** Next delivery date with pending orders from today on; today if none. */
export async function defaultOrderDate() {
  const today = todayInLima();
  const [r] = await db
    .select({ d: sql<string | null>`min(${orders.deliveryOn})` })
    .from(orders)
    .where(and(eq(orders.status, "PENDIENTE"), gte(orders.deliveryOn, today)));
  return r?.d ?? today;
}

export async function listOrders(f: { date: string; routeId: string; includeCancelled: boolean }) {
  const where: (SQL | undefined)[] = [eq(orders.deliveryOn, f.date), f.includeCancelled ? undefined : ne(orders.status, "ANULADO")];
  if (f.routeId) where.push(eq(customers.routeId, f.routeId));
  return db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      customerName: customers.name,
      routeName: routes.name,
      lines: count(orderItems.id),
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(routes, eq(routes.id, customers.routeId))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(...where))
    .groupBy(orders.id, customers.id, routes.id)
    .orderBy(asc(routes.name), asc(customers.routeOrder), asc(orders.number));
}
export type OrderRow = Awaited<ReturnType<typeof listOrders>>[number];

export async function getOrder(id: string) {
  const [o] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      deliveryOn: orders.deliveryOn,
      customerId: orders.customerId,
      sheetNumber: deliverySheets.number,
      sheetStatus: deliverySheets.status,
      sheetVehicleId: deliverySheets.vehicleId,
    })
    .from(orders)
    .leftJoin(deliverySheets, eq(deliverySheets.id, orders.sheetId))
    .where(eq(orders.id, id));
  if (!o) return null;
  const { sheetNumber, sheetStatus, sheetVehicleId, ...order } = o;
  const sheet = sheetNumber === null ? null : { number: sheetNumber, status: sheetStatus!, vehicleId: sheetVehicleId! };
  const items = await db
    .select({
      packagingId: orderItems.packagingId,
      quantity: orderItems.quantity,
      price: orderItems.price,
      productName: products.name,
      packagingName: packagings.name,
      productId: packagings.productId,
      factor: packagings.factor,
      delivered: orderItems.delivered,
    })
    .from(orderItems)
    .innerJoin(packagings, eq(packagings.id, orderItems.packagingId))
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id));
  return { ...order, sheet, items };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

/** Lines of the customer's last non-cancelled order, only packagings of active products; `omitted` counts the rest. */
export async function lastOrderLines(customerId: string) {
  const [last] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.customerId, customerId), ne(orders.status, "ANULADO")))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (!last) return null;
  const items = await db
    .select({ packagingId: orderItems.packagingId, quantity: orderItems.quantity, active: products.active })
    .from(orderItems)
    .innerJoin(packagings, eq(packagings.id, orderItems.packagingId))
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(eq(orderItems.orderId, last.id));
  return {
    lines: items.filter((i) => i.active).map(({ packagingId, quantity }) => ({ packagingId, quantity })),
    omitted: items.filter((i) => !i.active).length,
  };
}

/** Base units held by PENDING orders per product, except `excludeOrderId` (the one being edited) and orders already loaded (sheet EN_RUTA). */
export async function reservedByProduct(excludeOrderId?: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ productId: packagings.productId, qty: sql`sum(${orderItems.quantity}::bigint * ${packagings.factor})`.mapWith(Number) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(packagings, eq(packagings.id, orderItems.packagingId))
    .leftJoin(deliverySheets, eq(deliverySheets.id, orders.sheetId))
    .where(
      and(
        eq(orders.status, "PENDIENTE"),
        sql`${deliverySheets.status} is distinct from 'EN_RUTA'`, // their stock already left the warehouse
        excludeOrderId ? ne(orders.id, excludeOrderId) : undefined,
      ),
    )
    .groupBy(packagings.productId);
  return Object.fromEntries(rows.map((r) => [r.productId, r.qty]));
}

/** Free base units per product for the order form: warehouse stock − other pending orders. */
export async function availableByProduct(excludeOrderId?: string): Promise<Record<string, number>> {
  const [stock, reserved] = await Promise.all([stockByProduct(), reservedByProduct(excludeOrderId)]);
  const ids = new Set([...Object.keys(stock), ...Object.keys(reserved)]);
  return Object.fromEntries([...ids].map((id) => [id, available(stock[id] ?? 0, reserved[id] ?? 0)]));
}

/** Packagings of active products with their current price. Run inside saveOrder's tx: FOR SHARE holds price and active until commit. */
export function sellablePackagings(tx: Tx, ids: string[]) {
  return tx
    .select({ id: packagings.id, price: packagings.salePrice })
    .from(packagings)
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(and(inArray(packagings.id, ids), eq(products.active, true)))
    .orderBy(asc(products.id)) // lock rows in product id order, like receiveGoods and deliverOrder
    .for("share");
}

/** Orders due today (not cancelled): how many, how many delivered, total, and count per route. */
export async function todaySummary() {
  const rows = await db
    .select({ status: orders.status, total: orders.total, routeName: routes.name })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(routes, eq(routes.id, customers.routeId))
    .where(and(eq(orders.deliveryOn, todayInLima()), ne(orders.status, "ANULADO")));
  const perRoute = new Map<string, number>();
  for (const r of rows) perRoute.set(r.routeName, (perRoute.get(r.routeName) ?? 0) + 1);
  return {
    count: rows.length,
    delivered: rows.filter((r) => r.status === "ENTREGADO").length,
    total: rows.reduce((s, r) => s + r.total, 0),
    routes: [...perRoute].map(([name, n]) => ({ name, n })),
  };
}
export type TodaySummary = Awaited<ReturnType<typeof todaySummary>>;

/** Orders still pending for today or earlier (menu badge): what is left to deliver. */
export async function countPendingDue() {
  const [r] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.status, "PENDIENTE"), sql`${orders.deliveryOn} <= ${todayInLima()}`));
  return r.n;
}
