import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { customers, deliverySheets, locations, orderItems, orders, packagings, products, routes } from "@/server/db/schema";
import { warehouseLots } from "@/modules/inventory";
import { buildPicking } from "./picking";

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
    .select({ id: orders.id, number: orders.number, total: orders.total, customerName: customers.name, lines: count(orderItems.id) })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(pending, where))
    .groupBy(orders.id, customers.id)
    .orderBy(asc(customers.routeOrder), asc(orders.number));
export type SheetOrder = Awaited<ReturnType<typeof orderRows>>[number];

/** Header (with the vehicle capacity), its pending orders, and the candidates: pending orders of the route and date in no sheet. */
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
    })
    .from(deliverySheets)
    .innerJoin(routes, eq(routes.id, deliverySheets.routeId))
    .innerJoin(locations, eq(locations.id, deliverySheets.vehicleId))
    .where(eq(deliverySheets.id, id));
  if (!sheet) return null;
  const [inSheet, candidates] = await Promise.all([
    orderRows(eq(orders.sheetId, id)),
    orderRows(and(eq(orders.deliveryOn, sheet.date), isNull(orders.sheetId), eq(customers.routeId, sheet.routeId))),
  ]);
  return { ...sheet, orders: inSheet, candidates };
}
export type SheetDetail = NonNullable<Awaited<ReturnType<typeof getSheet>>>;

/** Picking of the sheet's pending orders, plus each product's packagings to show quantities. */
export async function getPicking(sheetId: string) {
  const lines = await db
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
  const ids = [...new Set(lines.map((l) => l.productId))];
  const [lots, packs] = await Promise.all([
    warehouseLots(ids),
    ids.length
      ? db
          .select({ productId: packagings.productId, name: packagings.name, factor: packagings.factor })
          .from(packagings)
          .where(inArray(packagings.productId, ids))
      : [],
  ]);
  return { ...buildPicking(lines, lots), packagings: Object.groupBy(packs, (p) => p.productId) };
}
export type SheetPicking = Awaited<ReturnType<typeof getPicking>>;
