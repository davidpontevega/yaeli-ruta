"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { audit, db } from "@/server/db";
import { customers, orderItems, orders } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { addDays, todayInLima } from "@/modules/inventory";
import { orderSchema } from "./schemas";
import { sellablePackagings } from "./queries";
import { orderTotal } from "./order-math";

const MAX_DAYS_AHEAD = 365;
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
    // Prices come from the DB, never from the form.
    const packs = await sellablePackagings(
      tx,
      o.lines.map((l) => l.packagingId),
    );
    const priceOf = new Map(packs.map((p) => [p.id, p.price]));
    if (priceOf.size !== o.lines.length) return "inactive";
    const items = o.lines.map((l) => ({ ...l, price: priceOf.get(l.packagingId)! }));
    const total = orderTotal(items);
    if (total > MAX_TOTAL) return "total"; // pedidos.total is a 32-bit integer
    let orderId = o.id;
    if (orderId) {
      const [cur] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).for("update");
      if (!cur) return "missing";
      if (cur.status !== "PENDIENTE") return "closed";
      await tx.update(orders).set({ deliveryOn: o.deliveryOn, total }).where(eq(orders.id, orderId));
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    } else {
      const [c] = await tx.select({ active: customers.active }).from(customers).where(eq(customers.id, o.customerId));
      if (!c?.active) return "customer";
      [{ id: orderId }] = await tx
        .insert(orders)
        .values({ customerId: o.customerId, deliveryOn: o.deliveryOn, total, userId: me.id })
        .returning({ id: orders.id });
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
      .update(orders)
      .set({ status: "ANULADO" })
      .where(and(eq(orders.id, id.data), eq(orders.status, "PENDIENTE")))
      .returning({ deliveryOn: orders.deliveryOn });
    if (o) await audit(tx, { actorId: me.id, action: "order.cancel", entity: "order", entityId: id.data });
    return o;
  });
  if (!done) return { error: "El pedido ya no está pendiente" };
  revalidatePath("/pedidos");
  redirect(`/pedidos?fecha=${done.deliveryOn}`);
}
