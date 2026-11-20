"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { audit, db, type Tx } from "@/server/db";
import { customers, deliverySheets, locations, orders, routes } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { todayInLima } from "@/modules/inventory";
import { createSheetSchema, sheetIdSchema, sheetOrderSchema } from "./schemas";

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

/** Locks the sheet until commit; only a PREPARANDO sheet can change. */
async function lockSheet(tx: Tx, id: string) {
  const [s] = await tx
    .select({ status: deliverySheets.status, routeId: deliverySheets.routeId, date: deliverySheets.date })
    .from(deliverySheets)
    .where(eq(deliverySheets.id, id))
    .for("update");
  if (!s) throw new SheetError("La hoja de ruta no existe");
  if (s.status !== "PREPARANDO") throw new SheetError("La hoja de ruta ya no se puede cambiar");
  return s;
}

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
      const s = await lockSheet(tx, sheetId);
      const done = await tx
        .update(orders)
        .set({ sheetId })
        .where(and(eq(orders.id, orderId), freeOrders(tx, s.routeId, s.date)))
        .returning({ id: orders.id });
      if (!done.length) throw new SheetError("El pedido ya no está disponible; recarga la página");
      await audit(tx, { actorId: me.id, action: "sheet.add_order", entity: "delivery_sheet", entityId: sheetId, details: { orderId } });
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
