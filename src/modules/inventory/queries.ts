import "server-only";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { locations, lots, products, receiptItems, receipts, stockLevels } from "@/server/db/schema";
import { listProducts } from "@/modules/catalog";

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
