"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { audit, db, type Tx } from "@/server/db";
import { customers, deliverySheets, locations, orders, products, routes, stockLevels } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { moveStock, todayInLima, warehouseLots } from "@/modules/inventory";
import { createSheetSchema, settleSchema, sheetIdSchema, sheetOrderSchema } from "./schemas";
import { sheetLines, sheetOrigins, sheetPayments } from "./queries";
import { returnPlan } from "./settlement";
import { buildPicking } from "./picking";

/** Thrown inside the transaction so nothing is saved; the message is shown to the owner. */
class SheetError extends Error {}

/** Pending orders of the route and date that are in no sheet, as a WHERE. Two sheets of the same route and date never share orders. */
const freeOrders = (tx: Tx, routeId: string, date: string) =>
  and(
    eq(orders.status, "PENDIENTE"),
    eq(orders.deliveryOn, date),
    isNull(orders.sheetId),
    inArray(orders.customerId, tx.select({ id: customers.id }).from(customers).where(eq(customers.routeId, routeId))),
  );

/** Locks the sheet until commit; only a sheet in `status` (PREPARANDO by default) can change. */
async function lockSheet(tx: Tx, id: string, status: "PREPARANDO" | "EN_RUTA" = "PREPARANDO") {
  const [s] = await tx
    .select({ status: deliverySheets.status, routeId: deliverySheets.routeId, date: deliverySheets.date, vehicleId: deliverySheets.vehicleId })
    .from(deliverySheets)
    .where(eq(deliverySheets.id, id))
    .for("update");
  if (!s) throw new SheetError("La hoja de ruta no existe");
  if (s.status !== status)
    throw new SheetError(status === "PREPARANDO" ? "La hoja de ruta ya no se puede cambiar" : "La hoja de ruta no está en ruta");
  return s;
}

/** Locks the products in id order (same order as receiveGoods and deliverOrder) and returns their average cost. */
async function lockProducts(tx: Tx, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await tx
    .select({ id: products.id, averageCost: products.averageCost })
    .from(products)
    .where(inArray(products.id, ids))
    .orderBy(asc(products.id))
    .for("update");
  return new Map(rows.map((r) => [r.id, r.averageCost]));
}

const revalidateLoad = (sheetId: string) => {
  revalidatePath(`/reparto/${sheetId}`);
  revalidatePath("/reparto");
  revalidatePath("/stock");
};

async function run(fn: () => Promise<void>): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof SheetError) return { error: e.message };
    throw e;
  }
}

export async function createSheet(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = createSheetSchema.safeParse({ routeId: form.get("routeId"), date: form.get("date"), vehicleId: form.get("vehicleId") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { routeId, date, vehicleId } = input.data;
  if (date < todayInLima()) return { error: "La fecha no puede ser pasada" };

  let sheetId = "";
  const r = await run(() =>
    db.transaction(async (tx) => {
      const [route] = await tx.select({ id: routes.id }).from(routes).where(eq(routes.id, routeId));
      if (!route) throw new SheetError("La ruta no existe");
      const [v] = await tx.select({ type: locations.type, active: locations.active }).from(locations).where(eq(locations.id, vehicleId));
      if (v?.type !== "VEHICULO" || !v.active) throw new SheetError("Elige un vehículo activo");
      [{ id: sheetId }] = await tx.insert(deliverySheets).values({ routeId, date, vehicleId, userId: me.id }).returning({ id: deliverySheets.id });
      const taken = await tx
        .update(orders)
        .set({ sheetId })
        .where(freeOrders(tx, routeId, date))
        .returning({ id: orders.id });
      await audit(tx, {
        actorId: me.id,
        action: "sheet.create",
        entity: "delivery_sheet",
        entityId: sheetId,
        details: { routeId, date, vehicleId, orderIds: taken.map((o) => o.id) },
      });
    }),
  );
  if (r) return r;
  revalidatePath("/reparto");
  redirect(`/reparto/${sheetId}`);
}

export async function addSheetOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = sheetOrderSchema.safeParse({ sheetId: form.get("sheetId"), orderId: form.get("orderId") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { sheetId, orderId } = input.data;
  const r = await run(() =>
    db.transaction(async (tx) => {
      // Lock both sheets (this one and the one the order comes from) in id order before the order, like loadVehicle: sheet → orders.
      const [o0] = await tx.select({ sheetId: orders.sheetId }).from(orders).where(eq(orders.id, orderId));
      if (o0?.sheetId === sheetId) throw new SheetError("El pedido ya está en esta hoja");
      const ids = [sheetId, ...(o0?.sheetId ? [o0.sheetId] : [])].sort();
      const locked = new Map<string, Awaited<ReturnType<typeof lockSheet>>>();
      for (const id of ids) locked.set(id, await lockSheet(tx, id));
      const s = locked.get(sheetId)!;
      const [o] = await tx
        .select({ status: orders.status, sheetId: orders.sheetId, deliveryOn: orders.deliveryOn, routeId: customers.routeId })
        .from(orders)
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .where(eq(orders.id, orderId))
        .for("update", { of: orders });
      if (!o || o.status !== "PENDIENTE" || o.routeId !== s.routeId || o.sheetId !== (o0?.sheetId ?? null))
        throw new SheetError("El pedido ya no está disponible; recarga la página");
      // Adding it to the sheet also moves its delivery date to the sheet's date.
      await tx.update(orders).set({ sheetId, deliveryOn: s.date }).where(eq(orders.id, orderId));
      await audit(tx, {
        actorId: me.id,
        action: "sheet.add_order",
        entity: "delivery_sheet",
        entityId: sheetId,
        details: { orderId, fromSheetId: o.sheetId, fromDate: o.deliveryOn },
      });
    }),
  );
  if (r) return r;
  revalidatePath(`/reparto/${sheetId}`);
}

export async function removeSheetOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = sheetOrderSchema.safeParse({ sheetId: form.get("sheetId"), orderId: form.get("orderId") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { sheetId, orderId } = input.data;
  const r = await run(() =>
    db.transaction(async (tx) => {
      await lockSheet(tx, sheetId);
      const done = await tx
        .update(orders)
        .set({ sheetId: null })
        .where(and(eq(orders.id, orderId), eq(orders.sheetId, sheetId)))
        .returning({ id: orders.id });
      if (!done.length) throw new SheetError("El pedido ya no está en la hoja; recarga la página");
      await audit(tx, { actorId: me.id, action: "sheet.remove_order", entity: "delivery_sheet", entityId: sheetId, details: { orderId } });
    }),
  );
  if (r) return r;
  revalidatePath(`/reparto/${sheetId}`);
}

/** Frees every order of the sheet and deletes it (a PREPARANDO sheet moved no stock). */
export async function deleteSheet(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = sheetIdSchema.safeParse({ sheetId: form.get("sheetId") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { sheetId } = input.data;
  let date = "";
  const r = await run(() =>
    db.transaction(async (tx) => {
      ({ date } = await lockSheet(tx, sheetId));
      const freed = await tx.update(orders).set({ sheetId: null }).where(eq(orders.sheetId, sheetId)).returning({ id: orders.id });
      await tx.delete(deliverySheets).where(eq(deliverySheets.id, sheetId));
      await audit(tx, {
        actorId: me.id,
        action: "sheet.delete",
        entity: "delivery_sheet",
        entityId: sheetId,
        details: { orderIds: freed.map((o) => o.id) },
      });
    }),
  );
  if (r) return r;
  revalidatePath("/reparto");
  redirect(`/reparto?fecha=${date}`);
}

/** PREPARANDO → EN_RUTA: moves the recalculated FEFO picking from the floors to the vehicle. Short stock loads what there is. */
export async function loadVehicle(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = sheetIdSchema.safeParse({ sheetId: form.get("sheetId") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { sheetId } = input.data;
  const r = await run(() =>
    db.transaction(async (tx) => {
      // Lock order: sheet → vehicle → orders → products. deliverOrder takes order → products: no cycle.
      const { vehicleId } = await lockSheet(tx, sheetId);
      const [v] = await tx
        .select({ type: locations.type, active: locations.active })
        .from(locations)
        .where(eq(locations.id, vehicleId))
        .for("update");
      if (v?.type !== "VEHICULO" || !v.active) throw new SheetError("El vehículo no está activo");
      const [busy] = await tx
        .select({ number: deliverySheets.number })
        .from(deliverySheets)
        .where(and(eq(deliverySheets.vehicleId, vehicleId), eq(deliverySheets.status, "EN_RUTA")));
      if (busy) throw new SheetError(`El vehículo ya está en ruta (hoja #${busy.number})`);
      const pendingOrders = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.sheetId, sheetId), eq(orders.status, "PENDIENTE")))
        .orderBy(asc(orders.id))
        .for("update");
      if (!pendingOrders.length) throw new SheetError("La hoja no tiene pedidos pendientes");

      // Recalculated here (never quantities from the form), with the products locked so stock can't change under us.
      const lines = await sheetLines(sheetId, tx);
      const ids = [...new Set(lines.map((l) => l.productId))];
      const cost = await lockProducts(tx, ids);
      const picking = buildPicking(lines, await warehouseLots(ids, tx));
      const moved = picking.floors.flatMap((f) => f.items.map((i) => ({ ...i, locationId: f.locationId })));
      for (const i of moved) {
        const ok = await moveStock(tx, {
          lotId: i.lotId,
          fromId: i.locationId,
          toId: vehicleId,
          quantity: i.baseQty,
          unitCost: cost.get(i.productId)!,
          documentId: sheetId,
          userId: me.id,
        });
        if (!ok) throw new SheetError("El stock cambió; recarga la página");
      }
      await tx.update(deliverySheets).set({ status: "EN_RUTA" }).where(eq(deliverySheets.id, sheetId));
      await audit(tx, {
        actorId: me.id,
        action: "sheet.load",
        entity: "delivery_sheet",
        entityId: sheetId,
        details: {
          vehicleId,
          lines: moved.map((i) => ({ lotId: i.lotId, locationId: i.locationId, quantity: i.baseQty })),
          short: picking.short.map((s) => ({ productId: s.productId, missing: s.missing })),
        },
      });
    }),
  );
  if (r) return r;
  revalidateLoad(sheetId);
}

/** EN_RUTA → PREPARANDO: returns each lot to the floor it came from (net TRASLADO of the sheet), only while the vehicle still holds it all. */
export async function unloadVehicle(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = sheetIdSchema.safeParse({ sheetId: form.get("sheetId") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { sheetId } = input.data;
  const r = await run(() =>
    db.transaction(async (tx) => {
      const { vehicleId } = await lockSheet(tx, sheetId, "EN_RUTA");
      const [delivered] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.sheetId, sheetId), eq(orders.status, "ENTREGADO")))
        .limit(1);
      if (delivered) throw new SheetError("Ya salió mercadería del vehículo; se resuelve en la liquidación");
      // Net per (lot, floor) still out of that floor. The net makes repeated load/unload add up.
      const out = await sheetOrigins(sheetId, tx);
      const cost = await lockProducts(tx, [...new Set(out.map((o) => o.productId))]);
      for (const o of out) {
        const ok = await moveStock(tx, {
          lotId: o.lotId,
          fromId: vehicleId,
          toId: o.locationId,
          quantity: o.quantity,
          unitCost: cost.get(o.productId)!,
          documentId: sheetId,
          userId: me.id,
        });
        if (!ok) throw new SheetError("Ya salió mercadería del vehículo; se resuelve en la liquidación");
      }
      await tx.update(deliverySheets).set({ status: "PREPARANDO" }).where(eq(deliverySheets.id, sheetId));
      await audit(tx, {
        actorId: me.id,
        action: "sheet.unload",
        entity: "delivery_sheet",
        entityId: sheetId,
        details: { vehicleId, lines: out.map(({ lotId, locationId, quantity }) => ({ lotId, locationId, quantity })) },
      });
    }),
  );
  if (r) return r;
  revalidateLoad(sheetId);
}

/**
 * EN_RUTA → LIQUIDADA: pending orders leave the sheet (still PENDIENTE), what is left on the vehicle goes back to the floors it came from,
 * and the cash expected (recalculated here) vs. handed in is saved. A difference doesn't block.
 */
export async function settleSheet(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = settleSchema.safeParse({ sheetId: form.get("sheetId"), declared: form.get("declared") ?? "" });
  if (!input.success) return { error: input.error.issues[0].message };
  const { sheetId, declared } = input.data;
  const r = await run(() =>
    db.transaction(async (tx) => {
      // Lock order: sheet → orders → products. deliverOrder takes order → products and reads the sheet unlocked: no cycle.
      const { vehicleId } = await lockSheet(tx, sheetId, "EN_RUTA");
      const undelivered = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.sheetId, sheetId), eq(orders.status, "PENDIENTE")))
        .orderBy(asc(orders.id))
        .for("update");
      const origins = await sheetOrigins(sheetId, tx);
      const cost = await lockProducts(tx, [...new Set(origins.map((o) => o.productId))]);
      // Vehicle stock read after locking the products, so a concurrent delivery can't change it under us.
      const vehicle = origins.length
        ? await tx
            .select({ lotId: stockLevels.lotId, quantity: stockLevels.quantity })
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.locationId, vehicleId),
                gt(stockLevels.quantity, 0),
                inArray(
                  stockLevels.lotId,
                  origins.map((o) => o.lotId),
                ),
              ),
            )
        : [];
      const productOf = new Map(origins.map((o) => [o.lotId, o.productId]));
      const returned = returnPlan(vehicle, origins);
      for (const l of returned) {
        const ok = await moveStock(tx, {
          lotId: l.lotId,
          fromId: vehicleId,
          toId: l.locationId,
          quantity: l.quantity,
          unitCost: cost.get(productOf.get(l.lotId)!)!,
          documentId: sheetId,
          userId: me.id,
        });
        if (!ok) throw new SheetError("El stock cambió; recarga la página");
      }
      if (undelivered.length)
        await tx
          .update(orders)
          .set({ sheetId: null })
          .where(
            inArray(
              orders.id,
              undelivered.map((o) => o.id),
            ),
          );
      const { expected } = await sheetPayments(sheetId, tx);
      await tx
        .update(deliverySheets)
        .set({ status: "LIQUIDADA", expectedCash: expected, declaredCash: declared, settledAt: new Date() })
        .where(eq(deliverySheets.id, sheetId));
      await audit(tx, {
        actorId: me.id,
        action: "sheet.settle",
        entity: "delivery_sheet",
        entityId: sheetId,
        details: { expected, declared, difference: declared - expected, undeliveredOrderIds: undelivered.map((o) => o.id), returned },
      });
    }),
  );
  if (r) return r;
  revalidateLoad(sheetId);
  revalidatePath("/pedidos");
}
