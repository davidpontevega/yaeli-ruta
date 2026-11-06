import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { locations, lots, packagings, products, readAliases, receiptItems, receipts, stockLevels } from "@/server/db/schema";
import { listProducts } from "@/modules/catalog";
import { addDays, daysUntil, expiryBucket, todayInLima, type ExpiryBucket } from "./expiry";

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

/** Active products with stock per lot and location. `value` (céntimos) only when `withCost`. */
export async function listStock(f: { q: string; categoryId: string; withCost: boolean }) {
  const items = await listProducts({
    q: f.q,
    categoryId: f.categoryId,
    includeInactive: false,
  });
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

  return items.map((p) => {
    const mine = rows.filter((r) => r.productId === p.id);
    const total = mine.reduce((s, r) => s + r.quantity, 0);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      packagings: p.packagings.map((x) => ({ name: x.name, factor: x.factor })),
      total,
      value: f.withCost ? total * (mine[0]?.averageCost ?? 0) : null,
      lots: mine.map(({ location, expiresOn, quantity }) => ({
        location,
        expiresOn,
        quantity,
      })),
    };
  });
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
