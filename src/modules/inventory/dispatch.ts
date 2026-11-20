import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import { locations, lots, products, stockLevels, stockMovements } from "@/server/db/schema";
import { fefoPick } from "@/lib/fefo";

/**
 * Takes `baseQty` of a product out of the warehouse floors (FEFO) inside the caller's transaction, recording VENTA movements.
 * Callers must dispatch products in id order (as receiveGoods does) so concurrent locks never deadlock.
 */
export async function dispatchStock(
  tx: Tx,
  d: { productId: string; baseQty: number; orderId: string; userId: string },
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
    .where(and(eq(lots.productId, d.productId), eq(locations.type, "ALMACEN"), gt(stockLevels.quantity, 0)));
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
