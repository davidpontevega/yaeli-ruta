import "server-only";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import { locations, lots, products, stockLevels, stockMovements } from "@/server/db/schema";
import { fefoPick } from "@/lib/fefo";

/**
 * Takes `baseQty` of a product out of the warehouse floors, or only `fromId` (a vehicle) when given (FEFO) inside the caller's transaction, recording VENTA movements.
 * Callers must dispatch products in id order (as receiveGoods does) so concurrent locks never deadlock.
 */
export async function dispatchStock(
  tx: Tx,
  d: { productId: string; baseQty: number; orderId: string; userId: string; fromId?: string },
): Promise<{ ok: true } | { ok: false; available: number }> {
  // Same lock as receiveGoods: stock and average cost of this product can't change under us.
  const [prod] = await tx.select({ averageCost: products.averageCost }).from(products).where(eq(products.id, d.productId)).for("update");
  const rows = await tx
    .select({
      lotId: stockLevels.lotId,
      locationId: stockLevels.locationId,
      locationName: locations.name,
      expiresOn: lots.expiresOn,
      quantity: stockLevels.quantity,
    })
    .from(stockLevels)
    .innerJoin(lots, eq(lots.id, stockLevels.lotId))
    .innerJoin(locations, eq(locations.id, stockLevels.locationId))
    .where(
      and(
        eq(lots.productId, d.productId),
        d.fromId ? eq(stockLevels.locationId, d.fromId) : eq(locations.type, "ALMACEN"),
        gt(stockLevels.quantity, 0),
      ),
    );
  const pick = fefoPick(rows, d.baseQty);
  if (!pick) return { ok: false, available: rows.reduce((s, r) => s + r.quantity, 0) };
  for (const p of pick) {
    await tx
      .update(stockLevels)
      .set({ quantity: sql`${stockLevels.quantity} - ${p.quantity}` })
      .where(and(eq(stockLevels.lotId, p.lotId), eq(stockLevels.locationId, p.locationId)));
    await tx.insert(stockMovements).values({
      type: "VENTA",
      lotId: p.lotId,
      locationId: p.locationId,
      quantity: -p.quantity,
      unitCost: prod.averageCost,
      documentId: d.orderId,
      userId: d.userId,
    });
  }
  return { ok: true };
}

/**
 * Moves `quantity` of a lot from one location to another: from −q, to +q (upsert), two TRASLADO movements.
 * false (and nothing written) when `from` doesn't hold `quantity`. The caller locks the product (FOR UPDATE) for `unitCost`.
 */
export async function moveStock(
  tx: Tx,
  d: { lotId: string; fromId: string; toId: string; quantity: number; unitCost: number; documentId: string; userId: string },
): Promise<boolean> {
  const taken = await tx
    .update(stockLevels)
    .set({ quantity: sql`${stockLevels.quantity} - ${d.quantity}` })
    .where(and(eq(stockLevels.lotId, d.lotId), eq(stockLevels.locationId, d.fromId), gte(stockLevels.quantity, d.quantity)))
    .returning({ lotId: stockLevels.lotId });
  if (!taken.length) return false;
  await tx
    .insert(stockLevels)
    .values({ locationId: d.toId, lotId: d.lotId, quantity: d.quantity })
    .onConflictDoUpdate({
      target: [stockLevels.locationId, stockLevels.lotId],
      set: { quantity: sql`${stockLevels.quantity} + excluded.cantidad` },
    });
  const move = { type: "TRASLADO" as const, lotId: d.lotId, unitCost: d.unitCost, documentId: d.documentId, userId: d.userId };
  await tx.insert(stockMovements).values([
    { ...move, locationId: d.fromId, quantity: -d.quantity },
    { ...move, locationId: d.toId, quantity: d.quantity },
  ]);
  return true;
}
