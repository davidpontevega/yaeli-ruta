import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import {
  customers,
  deliverySheets,
  orders,
  locations,
  lots,
  packagings,
  products,
  readAliases,
  receiptItems,
  receipts,
  stockLevels,
  stockMovements,
  suppliers,
} from "@/server/db/schema";
import { listProducts } from "@/modules/catalog";
import { stockStatus } from "@/lib/quantity";
import { addDays, daysUntil, expiryBucket, todayInLima, type ExpiryBucket } from "./expiry";
import type { StockLot } from "@/lib/fefo";
import { SALES_WINDOW_DAYS, coverageDays, isLowCoverage, targetStock, weeklySales } from "./coverage";

/** Warehouse floors where goods can be received (vehicles get stock by transfer, later). */
export function listLocations() {
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(and(eq(locations.active, true), eq(locations.type, "ALMACEN")))
    .orderBy(asc(locations.name));
}

/** Most recent receipt cost (céntimos) per packaging id. Exact per packaging, unlike products.lastCost (per base unit, rounded). */
export async function getLastCosts(): Promise<Record<string, number>> {
  const rows = await db
    .selectDistinctOn([receiptItems.packagingId], {
      packagingId: receiptItems.packagingId,
      cost: receiptItems.cost,
    })
    .from(receiptItems)
    .innerJoin(receipts, eq(receipts.id, receiptItems.receiptId))
    .orderBy(receiptItems.packagingId, desc(receipts.createdAt));
  return Object.fromEntries(rows.map((r) => [r.packagingId, r.cost]));
}

/** Base units sold (VENTA movements) per product in the last SALES_WINDOW_DAYS. Products without sales are absent. */
export async function recentSales(): Promise<Record<string, number>> {
  const rows = await db
    .select({ productId: lots.productId, sold: sql`-sum(${stockMovements.quantity})`.mapWith(Number) })
    .from(stockMovements)
    .innerJoin(lots, eq(lots.id, stockMovements.lotId))
    .where(and(eq(stockMovements.type, "VENTA"), gte(stockMovements.createdAt, sql`now() - make_interval(days => ${SALES_WINDOW_DAYS})`)))
    .groupBy(lots.productId);
  return Object.fromEntries(rows.map((r) => [r.productId, r.sold]));
}

/**
 * Active products with stock per lot and location, and their status against the minimum. `value` (céntimos) only when `withCost`.
 * `withSales` (owner only): weekly sales, days of coverage, 14-day target and low coverage.
 * `onlyMissing`: only low or out-of-stock products, or with low coverage.
 */
export async function listStock(f: {
  q: string;
  categoryId: string;
  supplierId: string;
  onlyMissing: boolean;
  withCost: boolean;
  withSales?: boolean;
}) {
  const [items, sales] = await Promise.all([
    listProducts({
      q: f.q,
      categoryId: f.categoryId,
      supplierId: f.supplierId,
      includeInactive: false,
    }),
    f.withSales ? recentSales() : ({} as Record<string, number>),
  ]);
  const rows = items.length
    ? await db
        .select({
          productId: lots.productId,
          location: locations.name,
          expiresOn: lots.expiresOn,
          quantity: stockLevels.quantity,
          averageCost: products.averageCost,
        })
        .from(stockLevels)
        .innerJoin(lots, eq(lots.id, stockLevels.lotId))
        .innerJoin(locations, eq(locations.id, stockLevels.locationId))
        .innerJoin(products, eq(products.id, lots.productId))
        .where(
          and(
            gt(stockLevels.quantity, 0),
            inArray(
              lots.productId,
              items.map((p) => p.id),
            ),
          ),
        )
        .orderBy(asc(lots.expiresOn), asc(locations.name))
    : [];

  const list = items.map((p) => {
    const mine = rows.filter((r) => r.productId === p.id);
    const total = mine.reduce((s, r) => s + r.quantity, 0);
    const sold = sales[p.id] ?? 0;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      minStock: p.minStock,
      status: stockStatus(total, p.minStock),
      packagings: p.packagings.map((x) => ({ id: x.id, name: x.name, factor: x.factor })),
      total,
      value: f.withCost ? total * (mine[0]?.averageCost ?? 0) : null,
      weeklySales: weeklySales(sold),
      coverageDays: coverageDays(total, sold),
      target: targetStock(sold),
      lowCoverage: isLowCoverage(total, sold),
      lots: mine.map(({ location, expiresOn, quantity }) => ({
        location,
        expiresOn,
        quantity,
      })),
    };
  });
  return f.onlyMissing ? list.filter((p) => p.status !== "ok" || p.lowCoverage) : list;
}

export type StockItem = Awaited<ReturnType<typeof listStock>>[number];

/** Learned aliases: normalized document text → packaging id. */
export async function listReadAliases(): Promise<Record<string, string>> {
  const rows = await db.select({ text: readAliases.text, packagingId: readAliases.packagingId }).from(readAliases);
  return Object.fromEntries(rows.map((r) => [r.text, r.packagingId]));
}

const EXPIRY_HORIZON_DAYS = 90;

/** Lots with stock that expire within 90 days (or already expired), per location. `value` (céntimos) only when `withCost`. */
export async function listExpiring(f: { locationId: string; withCost: boolean }) {
  const today = todayInLima();
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      location: locations.name,
      expiresOn: lots.expiresOn,
      quantity: stockLevels.quantity,
      averageCost: products.averageCost,
    })
    .from(stockLevels)
    .innerJoin(lots, eq(lots.id, stockLevels.lotId))
    .innerJoin(locations, eq(locations.id, stockLevels.locationId))
    .innerJoin(products, eq(products.id, lots.productId))
    .where(
      and(
        gt(stockLevels.quantity, 0),
        eq(products.active, true),
        isNotNull(lots.expiresOn),
        lte(lots.expiresOn, addDays(today, EXPIRY_HORIZON_DAYS)),
        f.locationId ? eq(stockLevels.locationId, f.locationId) : undefined,
      ),
    )
    .orderBy(asc(lots.expiresOn), asc(products.name));

  const packs = rows.length
    ? await db
        .select({ productId: packagings.productId, name: packagings.name, factor: packagings.factor })
        .from(packagings)
        .where(inArray(packagings.productId, [...new Set(rows.map((r) => r.productId))]))
    : [];

  return rows.map((r) => {
    const days = daysUntil(r.expiresOn!, today);
    return {
      productId: r.productId,
      productName: r.productName,
      location: r.location,
      expiresOn: r.expiresOn!,
      days,
      bucket: expiryBucket(days) as ExpiryBucket,
      quantity: r.quantity,
      packagings: packs.filter((p) => p.productId === r.productId),
      value: f.withCost ? r.quantity * r.averageCost : null,
    };
  });
}

export type ExpiringLot = Awaited<ReturnType<typeof listExpiring>>[number];

/** Counts for the home alerts: expired lots, lots expiring within 30 days, active products below their minimum. */
export async function getAlertCounts() {
  const today = todayInLima();
  const lotCount = (...where: Parameters<typeof and>) =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(stockLevels)
      .innerJoin(lots, eq(lots.id, stockLevels.lotId))
      .innerJoin(products, eq(products.id, lots.productId))
      .where(and(gt(stockLevels.quantity, 0), eq(products.active, true), ...where))
      .then(([r]) => r.n);

  const [expired, within30, low] = await Promise.all([
    lotCount(lt(lots.expiresOn, today)),
    lotCount(gte(lots.expiresOn, today), lte(lots.expiresOn, addDays(today, 30))),
    db
      .select({ id: products.id })
      .from(products)
      .leftJoin(lots, eq(lots.productId, products.id))
      .leftJoin(stockLevels, eq(stockLevels.lotId, lots.id))
      .where(and(eq(products.active, true), gt(products.minStock, 0)))
      .groupBy(products.id)
      .having(sql`coalesce(sum(${stockLevels.quantity}), 0) < ${products.minStock}`),
  ]);
  return { expired, within30, lowStock: low.length };
}

/** Supplier names, for the receipt form's suggestions. */
export function listSupplierNames() {
  return db
    .select({ name: suppliers.name })
    .from(suppliers)
    .orderBy(asc(suppliers.name))
    .then((rows) => rows.map((r) => r.name));
}

/** Suppliers with purchase count, total bought (céntimos) and last purchase, most recent first. */
export function listSupplierStats() {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      phone: suppliers.phone,
      purchases: sql<number>`count(${receipts.id})::int`,
      total: sql<number>`coalesce(sum(${receipts.total}), 0)::int`,
      lastPurchase: sql<Date | null>`max(${receipts.createdAt})`,
    })
    .from(suppliers)
    .leftJoin(receipts, eq(receipts.supplierId, suppliers.id))
    .groupBy(suppliers.id)
    .orderBy(sql`max(${receipts.createdAt}) desc nulls last`, asc(suppliers.name));
}

export type SupplierStats = Awaited<ReturnType<typeof listSupplierStats>>[number];

export const MOVEMENT_LIMIT = 100;

/** Last 100 movements of a product, newest first, with the product balance right after each one. */
export function listMovements(productId: string) {
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      createdAt: stockMovements.createdAt,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      location: locations.name,
      expiresOn: lots.expiresOn,
      // Fields named for purchases; on a sale `supplier` holds the customer and `document` the order (or, on a transfer, sheet) number.
      supplier: sql<string | null>`coalesce(${receipts.supplier}, ${customers.name})`,
      document: sql<string | null>`coalesce(${receipts.document}, 'Pedido #' || ${orders.number}, 'Hoja #' || ${deliverySheets.number})`,
      // Window over ALL the product's movements (computed before LIMIT), so the balance is exact.
      balance: sql<number>`(sum(${stockMovements.quantity}) over (order by ${stockMovements.createdAt}, ${stockMovements.id}))::int`,
    })
    .from(stockMovements)
    .innerJoin(lots, eq(lots.id, stockMovements.lotId))
    .innerJoin(locations, eq(locations.id, stockMovements.locationId))
    .leftJoin(receipts, eq(receipts.id, stockMovements.documentId))
    .leftJoin(orders, eq(orders.id, stockMovements.documentId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(deliverySheets, eq(deliverySheets.id, stockMovements.documentId))
    .where(eq(lots.productId, productId))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(MOVEMENT_LIMIT);
}

export type Movement = Awaited<ReturnType<typeof listMovements>>[number];

/** Base units per product on `locationId`, or on the warehouse floors (not vehicles) when omitted. Products without stock are absent. */
export async function stockByProduct(locationId?: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ productId: lots.productId, qty: sql`sum(${stockLevels.quantity})`.mapWith(Number) })
    .from(stockLevels)
    .innerJoin(lots, eq(lots.id, stockLevels.lotId))
    .innerJoin(locations, eq(locations.id, stockLevels.locationId))
    .where(locationId ? eq(stockLevels.locationId, locationId) : eq(locations.type, "ALMACEN"))
    .groupBy(lots.productId);
  return Object.fromEntries(rows.map((r) => [r.productId, r.qty]));
}

const lotColumns = {
  productId: lots.productId,
  lotId: lots.id,
  locationId: locations.id,
  locationName: locations.name,
  expiresOn: lots.expiresOn,
  quantity: stockLevels.quantity,
};

/** Lots with stock on warehouse floors (not vehicles) for these products, ready for `fefoPick`. `q` = a transaction to read inside it. */
export function warehouseLots(productIds: string[], q: Tx | typeof db = db): Promise<(StockLot & { productId: string })[]> {
  if (!productIds.length) return Promise.resolve([]);
  return q
    .select(lotColumns)
    .from(stockLevels)
    .innerJoin(lots, eq(lots.id, stockLevels.lotId))
    .innerJoin(locations, eq(locations.id, stockLevels.locationId))
    .where(and(eq(locations.type, "ALMACEN"), gt(stockLevels.quantity, 0), inArray(lots.productId, productIds)));
}

/** Lots with stock on one location (a vehicle), ready for `buildPicking`. */
export function locationLots(locationId: string): Promise<(StockLot & { productId: string })[]> {
  return db
    .select(lotColumns)
    .from(stockLevels)
    .innerJoin(lots, eq(lots.id, stockLevels.lotId))
    .innerJoin(locations, eq(locations.id, stockLevels.locationId))
    .where(and(eq(stockLevels.locationId, locationId), gt(stockLevels.quantity, 0)));
}
