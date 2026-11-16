"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit, db, isForeignKeyViolation } from "@/server/db";
import { locations, packagings, products, purchaseItems, purchases } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { purchaseSchema } from "./schemas";

class PurchaseError extends Error {}

export async function savePurchase(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data")));
  } catch {
    return { error: "Datos inválidos" };
  }
  const input = purchaseSchema.safeParse(raw);
  if (!input.success) return { error: input.error.issues[0].message };
  const p = input.data;

  let purchaseId = p.id;
  try {
    await db.transaction(async (tx) => {
      if (p.id) {
        const [cur] = await tx.select({ status: purchases.status }).from(purchases).where(eq(purchases.id, p.id)).for("update");
        if (!cur) throw new PurchaseError("La compra no existe");
        if (cur.status !== "BORRADOR") throw new PurchaseError("La compra ya fue recibida o anulada");
      }
      const ok = await tx
        .select({ id: packagings.id })
        .from(packagings)
        .innerJoin(products, eq(products.id, packagings.productId))
        .where(
          and(
            inArray(
              packagings.id,
              p.lines.map((l) => l.packagingId),
            ),
            eq(products.active, true),
          ),
        );
      if (ok.length !== p.lines.length) throw new PurchaseError("Hay productos inactivos o eliminados; quítalos de la lista");
      if (p.vehicleId) {
        const [v] = await tx.select({ type: locations.type }).from(locations).where(eq(locations.id, p.vehicleId));
        if (v?.type !== "VEHICULO") throw new PurchaseError("Elige un vehículo válido");
      }
      const header = { type: p.type, supplierId: p.supplierId, vehicleId: p.vehicleId };
      if (purchaseId) {
        await tx.update(purchases).set(header).where(eq(purchases.id, purchaseId));
        await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));
      } else {
        [{ id: purchaseId }] = await tx
          .insert(purchases)
          .values({ ...header, userId: me.id })
          .returning({ id: purchases.id });
      }
      await tx.insert(purchaseItems).values(p.lines.map((l) => ({ ...l, purchaseId: purchaseId! })));
      await audit(tx, {
        actorId: me.id,
        action: p.id ? "purchase.update" : "purchase.create",
        entity: "purchase",
        entityId: purchaseId,
        details: { type: p.type, lines: p.lines.length },
      });
    });
  } catch (e) {
    if (e instanceof PurchaseError) return { error: e.message };
    if (isForeignKeyViolation(e)) return { error: "El proveedor no existe" }; // tampered supplier id
    throw e;
  }
  revalidatePath("/compras");
  redirect(`/compras/${purchaseId}`);
}

export async function cancelPurchase(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Compra inválida" };
  const done = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(purchases)
      .set({ status: "ANULADA" })
      .where(and(eq(purchases.id, id.data), eq(purchases.status, "BORRADOR")))
      .returning({ id: purchases.id });
    if (row) await audit(tx, { actorId: me.id, action: "purchase.cancel", entity: "purchase", entityId: id.data });
    return row;
  });
  if (!done) return { error: "La compra ya fue recibida o anulada" };
  revalidatePath("/compras");
  redirect("/compras");
}
