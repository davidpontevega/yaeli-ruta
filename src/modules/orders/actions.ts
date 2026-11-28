"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { audit, db } from "@/server/db";
import { customers, orderItems, orders } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { addDays, todayInLima } from "@/modules/inventory";
import { specialPriceMap } from "@/modules/customers";
import { deliverySchema, orderSchema } from "./schemas";
import { sellablePackagings } from "./queries";
import { orderTotal, priceFor } from "./order-math";
import { DeliveryError, deliverInTx, sheetOf } from "./deliver";

const MAX_DAYS_AHEAD = 365;

const inRoute = (n: number) => `El pedido está en ruta (hoja #${n})`;
const MAX_TOTAL = 2_000_000_000;

export async function saveOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data")));
  } catch {
    return { error: "Datos inválidos" };
  }
  const input = orderSchema.safeParse(raw);
  if (!input.success) return { error: input.error.issues[0].message };
  const o = input.data;
  const today = todayInLima();
  if (o.deliveryOn < today) return { error: "La fecha de entrega no puede ser pasada" };
  if (o.deliveryOn > addDays(today, MAX_DAYS_AHEAD)) return { error: "La fecha de entrega es demasiado lejana" };

  const result = await db.transaction(async (tx) => {
    // Lock order: order first, then products (same as deliverOrder), so the two never deadlock.
    // Editing: the customer comes from the order in the DB, never from the JSON (or another customer's prices would apply).
    let customerId = o.customerId;
    let movesDate = false;
    if (o.id) {
      const [cur] = await tx
        .select({ status: orders.status, customerId: orders.customerId, deliveryOn: orders.deliveryOn, sheetId: orders.sheetId })
        .from(orders)
        .where(eq(orders.id, o.id))
        .for("update");
      if (!cur) return "missing";
      if (cur.status !== "PENDIENTE") return "closed";
      const sheet = await sheetOf(tx, cur.sheetId);
      if (sheet?.status === "EN_RUTA") return { route: sheet.number };
      customerId = cur.customerId;
      movesDate = cur.deliveryOn !== o.deliveryOn;
    }
    // Prices come from the DB, never from the form.
    const packs = await sellablePackagings(
      tx,
      o.lines.map((l) => l.packagingId),
    );
    if (packs.length !== o.lines.length) return "inactive";
    const special = await specialPriceMap(customerId, tx);
    const priceOf = new Map(packs.map((p) => [p.id, priceFor({ id: p.id, salePrice: p.price }, special).price]));
    const items = o.lines.map((l) => ({ ...l, price: priceOf.get(l.packagingId)! }));
    const total = orderTotal(items);
    if (total > MAX_TOTAL) return "total"; // pedidos.total is a 32-bit integer
    let orderId = o.id;
    if (orderId) {
      // Another date leaves its delivery sheet (the sheet is for one date).
      await tx
        .update(orders)
        .set({ deliveryOn: o.deliveryOn, total, ...(movesDate && { sheetId: null }) })
        .where(eq(orders.id, orderId));
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    } else {
      const [c] = await tx.select({ active: customers.active }).from(customers).where(eq(customers.id, customerId));
      if (!c?.active) return "customer";
      [{ id: orderId }] = await tx.insert(orders).values({ customerId, deliveryOn: o.deliveryOn, total, userId: me.id }).returning({ id: orders.id });
    }
    await tx.insert(orderItems).values(items.map((i) => ({ ...i, orderId: orderId! })));
    await audit(tx, {
      actorId: me.id,
      action: o.id ? "order.update" : "order.create",
      entity: "order",
      entityId: orderId,
      details: { total, lines: items.length },
    });
    return "ok";
  });
  if (typeof result === "object") return { error: inRoute(result.route) };
  if (result === "inactive") return { error: "Hay productos inactivos o eliminados; quítalos del pedido" };
  if (result === "total") return { error: "El total del pedido es demasiado alto" };
  if (result === "missing") return { error: "El pedido no existe" };
  if (result === "closed") return { error: "El pedido ya no está pendiente" };
  if (result === "customer") return { error: "El cliente no existe o está inactivo" };
  revalidatePath("/pedidos");
  redirect(`/pedidos?fecha=${o.deliveryOn}`);
}

export async function cancelOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Pedido inválido" };
  const done = await db.transaction(async (tx) => {
    const [o] = await tx
      .select({ status: orders.status, deliveryOn: orders.deliveryOn, sheetId: orders.sheetId })
      .from(orders)
      .where(eq(orders.id, id.data))
      .for("update");
    if (o?.status !== "PENDIENTE") return "closed";
    const sheet = await sheetOf(tx, o.sheetId);
    if (sheet?.status === "EN_RUTA") return inRoute(sheet.number);
    await tx.update(orders).set({ status: "ANULADO" }).where(eq(orders.id, id.data));
    await audit(tx, { actorId: me.id, action: "order.cancel", entity: "order", entityId: id.data });
    return o;
  });
  if (done === "closed") return { error: "El pedido ya no está pendiente" };
  if (typeof done === "string") return { error: done };
  revalidatePath("/pedidos");
  redirect(`/pedidos?fecha=${done.deliveryOn}`);
}

/** Form: `orderId`, one `delivered_<packagingId>` per line, `paid` (S/) and `method`. Stock, charge and payment in one transaction. */
export async function deliverOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const lines = [...form.entries()]
    .filter(([k]) => k.startsWith("delivered_"))
    .map(([k, v]) => ({ packagingId: k.slice(10), delivered: String(v).trim() || "0" }));
  const input = deliverySchema.safeParse({ orderId: form.get("orderId"), lines, paid: form.get("paid") ?? "", method: form.get("method") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { orderId } = input.data;

  let routeSheetId: string | undefined; // sheet EN_RUTA of the order: the payment belongs to it and we go back to it
  try {
    ({ routeSheetId } = await db.transaction((tx) => deliverInTx(tx, input.data, me.id)));
  } catch (e) {
    if (e instanceof DeliveryError) return { error: e.message };
    throw e;
  }
  revalidatePath("/pedidos");
  revalidatePath("/deudores");
  if (routeSheetId) {
    revalidatePath(`/reparto/${routeSheetId}`);
    redirect(`/reparto/${routeSheetId}`);
  }
  redirect(`/pedidos/${orderId}`);
}
