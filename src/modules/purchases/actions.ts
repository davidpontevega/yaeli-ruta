"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { audit, db, isForeignKeyViolation } from "@/server/db";
import { locations, lots, packagings, products, purchaseItems, purchases, stockLevels, suppliers } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { STALE_LIST_ERROR, purchaseSchema } from "./schemas";
import { biggestPackaging, listVersion, missingToOrder } from "./purchase-math";
import { defaultCosts } from "./queries";

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
        const ids = await tx.select({ id: purchaseItems.id }).from(purchaseItems).where(eq(purchaseItems.purchaseId, p.id));
        if (listVersion(ids.map((i) => i.id)) !== p.version) throw new PurchaseError(STALE_LIST_ERROR);
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

export type AddToListState =
  { ok: true; purchaseId: string; number: number; supplierName: string; already: boolean } | { ok: false; error: string } | undefined;

/** One tap from a low product: its biggest packaging, enough to reach the minimum, into its supplier's newest draft (created if none). */
export async function addToPurchaseList(_: AddToListState, form: FormData): Promise<AddToListState> {
  const me = await requireUser("DUENO");
  const productId = z.uuid().safeParse(form.get("productId"));
  if (!productId.success) return { ok: false, error: "Producto inválido" };
  const costs = await defaultCosts();
  let result: AddToListState;
  try {
    result = await db.transaction(async (tx) => {
      const [product] = await tx
        .select({ supplierId: products.supplierId, minStock: products.minStock })
        .from(products)
        .where(and(eq(products.id, productId.data), eq(products.active, true)));
      if (!product) throw new PurchaseError("El producto no existe o está inactivo");
      const packs = await tx
        .select({ id: packagings.id, factor: packagings.factor })
        .from(packagings)
        .where(eq(packagings.productId, productId.data))
        .orderBy(packagings.factor, packagings.id);
      const big = biggestPackaging(packs);
      if (!big) throw new PurchaseError("El producto no tiene presentaciones");
      if (!product.supplierId) throw new PurchaseError("Asigna un proveedor al producto");

      // Queues every add for this supplier: no two drafts, no two lines.
      const [supplier] = await tx.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, product.supplierId)).for("no key update"); // serializes adds; does not block the KEY SHARE a purchase save takes on its supplier
      if (!supplier) throw new PurchaseError("El proveedor no existe");

      let [draft] = await tx
        .select({ id: purchases.id, number: purchases.number })
        .from(purchases)
        .where(and(eq(purchases.supplierId, product.supplierId), eq(purchases.status, "BORRADOR")))
        .orderBy(desc(purchases.createdAt))
        .limit(1)
        .for("update");
      if (!draft) {
        [draft] = await tx
          .insert(purchases)
          .values({ type: "ENVIA_PROVEEDOR", supplierId: product.supplierId, vehicleId: null, userId: me.id })
          .returning({ id: purchases.id, number: purchases.number });
        await audit(tx, {
          actorId: me.id,
          action: "purchase.create",
          entity: "purchase",
          entityId: draft.id,
          details: { type: "ENVIA_PROVEEDOR", lines: 0 },
        });
      }
      const base = { ok: true as const, purchaseId: draft.id, number: draft.number, supplierName: supplier.name };

      const [dup] = await tx
        .select({ id: purchaseItems.id })
        .from(purchaseItems)
        .where(
          and(
            eq(purchaseItems.purchaseId, draft.id),
            inArray(
              purchaseItems.packagingId,
              packs.map((x) => x.id),
            ),
          ),
        )
        .limit(1);
      if (dup) return { ...base, already: true };

      // Same total as listStock: every location, only positive balances.
      const [{ total }] = await tx
        .select({ total: sql`coalesce(sum(${stockLevels.quantity}), 0)`.mapWith(Number) })
        .from(stockLevels)
        .innerJoin(lots, eq(lots.id, stockLevels.lotId))
        .where(and(eq(lots.productId, productId.data), gt(stockLevels.quantity, 0)));
      const quantity = Math.max(1, missingToOrder(total, product.minStock, big.factor));
      const added = await tx
        .insert(purchaseItems)
        .values({ purchaseId: draft.id, packagingId: big.id, quantity, cost: costs[big.id] ?? 0, freight: 0 })
        .onConflictDoNothing()
        .returning({ id: purchaseItems.id });
      if (!added.length) return { ...base, already: true };
      await audit(tx, {
        actorId: me.id,
        action: "purchase.add_item",
        entity: "purchase",
        entityId: draft.id,
        details: { productId: productId.data, packagingId: big.id, quantity },
      });
      return { ...base, already: false };
    });
  } catch (e) {
    if (e instanceof PurchaseError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/compras");
  revalidatePath("/productos");
  revalidatePath("/stock");
  return result;
}
