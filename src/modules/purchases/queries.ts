import "server-only";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { locations, packagings, products, purchaseItems, purchases, suppliers } from "@/server/db/schema";
import { getLastCosts, listStock } from "@/modules/inventory";
import { biggestPackaging, listVersion, missingToOrder } from "./purchase-math";

/** Newest first, with goods + freight total and the known weight (grams). */
export function listPurchases() {
  return db
    .select({
      id: purchases.id,
      number: purchases.number,
      type: purchases.type,
      status: purchases.status,
      createdAt: purchases.createdAt,
      supplierName: suppliers.name,
      vehicleName: locations.name,
      lines: count(purchaseItems.id),
      total: sql`coalesce(sum(${purchaseItems.quantity} * ${purchaseItems.cost} + ${purchaseItems.freight}), 0)`.mapWith(Number),
      weight: sql`coalesce(sum(${purchaseItems.quantity} * ${packagings.weightGrams}), 0)`.mapWith(Number),
    })
    .from(purchases)
    .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .leftJoin(locations, eq(locations.id, purchases.vehicleId))
    .leftJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
    .leftJoin(packagings, eq(packagings.id, purchaseItems.packagingId))
    .groupBy(purchases.id, suppliers.id, locations.id)
    .orderBy(desc(purchases.createdAt))
    .limit(100);
}
export type PurchaseRow = Awaited<ReturnType<typeof listPurchases>>[number];

export async function getPurchase(id: string) {
  const [p] = await db
    .select({
      id: purchases.id,
      number: purchases.number,
      type: purchases.type,
      status: purchases.status,
      supplierId: purchases.supplierId,
      supplierName: suppliers.name,
      vehicleId: purchases.vehicleId,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .where(eq(purchases.id, id));
  if (!p) return null;
  const items = await db
    .select({
      id: purchaseItems.id,
      packagingId: purchaseItems.packagingId,
      quantity: purchaseItems.quantity,
      cost: purchaseItems.cost,
      freight: purchaseItems.freight,
      productName: products.name,
      packagingName: packagings.name,
    })
    .from(purchaseItems)
    .innerJoin(packagings, eq(packagings.id, purchaseItems.packagingId))
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(eq(purchaseItems.purchaseId, id))
    .orderBy(asc(purchaseItems.id));
  return { ...p, items, version: listVersion(items.map((i) => i.id)) };
}
export type PurchaseDetail = NonNullable<Awaited<ReturnType<typeof getPurchase>>>;

/** Low, out-of-stock or low-coverage products with a supplier: what to order, in the biggest packaging, to reach the minimum or 14 days of sales. */
export async function listMissingBySupplier() {
  const stock = await listStock({ q: "", categoryId: "", supplierId: "", onlyMissing: true, withCost: false, withSales: true });
  return stock.flatMap((p) => {
    const big = biggestPackaging(p.packagings);
    const quantity = big ? missingToOrder(p.total, Math.max(p.minStock, p.target), big.factor) : 0;
    return p.supplierId && big && quantity ? [{ supplierId: p.supplierId, packagingId: big.id, quantity }] : [];
  });
}

/** Vehicles with their max load, for the purchase form. */
export function listVehicles() {
  return db
    .select({ id: locations.id, name: locations.name, capacityKg: locations.capacityKg })
    .from(locations)
    .where(eq(locations.type, "VEHICULO"))
    .orderBy(asc(locations.name));
}

/** Cost to prefill per packaging: its last receipt cost, else the product's last cost × factor. */
export async function defaultCosts(): Promise<Record<string, number>> {
  const [last, packs] = await Promise.all([
    getLastCosts(),
    db
      .select({ id: packagings.id, factor: packagings.factor, lastCost: products.lastCost })
      .from(packagings)
      .innerJoin(products, eq(products.id, packagings.productId))
      .where(eq(products.active, true)),
  ]);
  return Object.fromEntries(packs.map((x) => [x.id, last[x.id] ?? x.lastCost * x.factor]));
}
