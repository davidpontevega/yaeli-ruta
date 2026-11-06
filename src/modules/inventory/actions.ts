"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { audit, db } from "@/server/db";
import { locations, lots, packagings, products, readAliases, receiptItems, receipts, stockLevels, stockMovements } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { receiptSchema } from "./schemas";
import { toBaseUnits, weightedAverageCost } from "./stock-math";
import { normalizeText } from "./document-read";

/** Purchase or opening balance: creates/merges lots, adds stock, logs movements and updates product cost. One tx. */
export async function receiveGoods(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data")));
  } catch {
    return { error: "Datos inválidos" };
  }
  const input = receiptSchema.safeParse(raw);
  if (!input.success) return { error: input.error.issues[0].message };
  const r = input.data;

  const packs = await db
    .select({
      id: packagings.id,
      factor: packagings.factor,
      productId: packagings.productId,
    })
    .from(packagings)
    .where(
      inArray(
        packagings.id,
        r.items.map((i) => i.packagingId),
      ),
    );
  const packById = new Map(packs.map((p) => [p.id, p]));
  if (r.items.some((i) => !packById.has(i.packagingId))) return { error: "Un producto ya no existe; recarga la página" };
  const floors = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.active, true),
        eq(locations.type, "ALMACEN"),
        inArray(
          locations.id,
          r.items.map((i) => i.locationId),
        ),
      ),
    );
  if (r.items.some((i) => !floors.some((f) => f.id === i.locationId))) return { error: "Un piso ya no existe; recarga la página" };
  // Lock products in a fixed order so two concurrent receipts can't deadlock.
  const items = [...r.items].sort((a, b) => packById.get(a.packagingId)!.productId.localeCompare(packById.get(b.packagingId)!.productId));

  const total = r.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const movementType = r.type === "COMPRA" ? "INGRESO" : "SALDO_INICIAL";

  await db.transaction(async (tx) => {
    const [{ id: receiptId }] = await tx
      .insert(receipts)
      .values({
        type: r.type,
        supplier: r.supplier,
        document: r.document,
        total,
        userId: me.id,
      })
      .returning({ id: receipts.id });

    for (const item of items) {
      const pack = packById.get(item.packagingId)!;
      const qty = toBaseUnits(item.quantity, pack.factor);
      const unitCost = item.unitCost / pack.factor;

      // Lock the product so two receipts can't compute the average from the same old stock.
      const [prod] = await tx.select({ averageCost: products.averageCost }).from(products).where(eq(products.id, pack.productId)).for("update");
      const [{ onHand }] = await tx
        .select({
          onHand: sql<number>`coalesce(sum(${stockLevels.quantity}), 0)::int`,
        })
        .from(stockLevels)
        .innerJoin(lots, eq(lots.id, stockLevels.lotId))
        .where(eq(lots.productId, pack.productId));

      const [{ id: lotId }] = await tx
        .insert(lots)
        .values({ productId: pack.productId, expiresOn: item.expiresOn })
        .onConflictDoUpdate({
          target: [lots.productId, lots.expiresOn],
          set: { productId: sql`excluded.producto_id` },
        })
        .returning({ id: lots.id });

      await tx
        .insert(stockLevels)
        .values({ locationId: item.locationId, lotId, quantity: qty })
        .onConflictDoUpdate({
          target: [stockLevels.locationId, stockLevels.lotId],
          set: { quantity: sql`${stockLevels.quantity} + excluded.cantidad` },
        });

      await tx.insert(stockMovements).values({
        type: movementType,
        lotId,
        locationId: item.locationId,
        quantity: qty,
        unitCost: Math.round(unitCost),
        documentId: receiptId,
        userId: me.id,
      });
      await tx.insert(receiptItems).values({
        receiptId,
        packagingId: item.packagingId,
        lotId,
        locationId: item.locationId,
        quantity: item.quantity,
        cost: item.unitCost,
      });
      await tx
        .update(products)
        .set({
          averageCost: weightedAverageCost(onHand, prod.averageCost, qty, unitCost),
          lastCost: Math.round(unitCost),
        })
        .where(eq(products.id, pack.productId));
    }

    // Learn how the supplier writes each product, so the next reading comes out "aprendido".
    for (const item of items) {
      const text = item.readText && normalizeText(item.readText);
      if (!text) continue;
      await tx
        .insert(readAliases)
        .values({ text, packagingId: item.packagingId })
        .onConflictDoUpdate({ target: readAliases.text, set: { packagingId: item.packagingId, updatedAt: new Date() } });
    }

    await audit(tx, {
      actorId: me.id,
      action: r.type === "COMPRA" ? "receipt.create" : "opening-balance.create",
      entity: "receipt",
      entityId: receiptId,
      details: { items: r.items.length, total },
    });
  });

  revalidatePath("/stock");
  redirect("/stock");
}
