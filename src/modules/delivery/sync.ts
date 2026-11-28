import "server-only";
import { eq } from "drizzle-orm";
import { db, isForeignKeyViolation } from "@/server/db";
import { deliverySheets, offlineOps, orders } from "@/server/db/schema";
import type { CurrentUser } from "@/server/auth";
import { deliverInTx, DeliveryError } from "@/modules/orders";
import type { OfflineOpInput } from "./schemas";
import type { SyncResult } from "./offline-queue";

/** Thrown when the op id is already stored: the tx did nothing and has nothing to roll back. */
class Duplicate extends Error {}

/**
 * Uploads deliveries made without signal, in order, each one in its own transaction.
 * The op id is stored first: a re-sent op is "duplicate" and changes nothing; a rejected one rolls back, id included, so a retry is evaluated again.
 */
export async function syncOps(me: Pick<CurrentUser, "id" | "role">, ops: OfflineOpInput[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const op of ops) {
    try {
      await db.transaction(async (tx) => {
        // Two concurrent uploads of the same id: the PK makes the second wait and then find the row.
        const [row] = await tx
          .insert(offlineOps)
          .values({ id: op.id, userId: me.id, orderId: op.orderId })
          .onConflictDoNothing()
          .returning({ id: offlineOps.id });
        if (!row) throw new Duplicate();
        const [o] = await tx.select({ status: orders.status, sheetId: orders.sheetId }).from(orders).where(eq(orders.id, op.orderId)).for("update");
        const [sheet] = await tx
          .select({ status: deliverySheets.status, driverId: deliverySheets.driverId })
          .from(deliverySheets)
          .where(eq(deliverySheets.id, op.sheetId));
        if (o?.sheetId !== op.sheetId || sheet?.status !== "EN_RUTA")
          throw new DeliveryError("La hoja ya se liquidó; el dueño debe entregarlo desde Pedidos");
        if (me.role === "REPARTIDOR" && sheet.driverId !== me.id) throw new DeliveryError("Esta hoja no es tuya");
        if (o.status !== "PENDIENTE") throw new DeliveryError("El pedido ya no está pendiente");
        await deliverInTx(tx, op, me.id, { offline: true, opId: op.id });
      });
      results.push({ id: op.id, result: "ok" });
    } catch (e) {
      if (e instanceof Duplicate) results.push({ id: op.id, result: "duplicate" });
      else if (e instanceof DeliveryError) results.push({ id: op.id, result: "rejected", reason: e.message });
      // The order id doesn't exist (FK of operaciones_offline).
      else if (isForeignKeyViolation(e)) results.push({ id: op.id, result: "rejected", reason: "El pedido no existe" });
      else throw e;
    }
  }
  return results;
}
