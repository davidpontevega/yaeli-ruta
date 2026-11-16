"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit, db } from "@/server/db";
import { customers, orderItems, orders, packagings, products } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { addDays, dispatchStock, todayInLima, toBaseUnits } from "@/modules/inventory";
import { addCharge, addPayment, lockedBalance } from "@/modules/accounts";
import { formatSoles } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { deliverySchema, orderSchema } from "./schemas";
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
    // Lock order: order first, then products (same as deliverOrder), so the two never deadlock.
    if (o.id) {
      const [cur] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, o.id)).for("update");
      if (!cur) return "missing";
      if (cur.status !== "PENDIENTE") return "closed";
    }
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

/** Thrown inside the delivery transaction so nothing is saved; the message is shown to the owner. */
class DeliveryError extends Error {}

/** Form: `orderId`, one `delivered_<packagingId>` per line, `paid` (S/) and `method`. Stock, charge and payment in one transaction. */
export async function deliverOrder(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const lines = [...form.entries()]
    .filter(([k]) => k.startsWith("delivered_"))
    .map(([k, v]) => ({ packagingId: k.slice(10), delivered: String(v).trim() || "0" }));
  const input = deliverySchema.safeParse({ orderId: form.get("orderId"), lines, paid: form.get("paid") ?? "", method: form.get("method") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { orderId, paid, method } = input.data;
  const deliveredOf = new Map(input.data.lines.map((l) => [l.packagingId, l.delivered]));

  try {
    await db.transaction(async (tx) => {
      const [o] = await tx
        .select({ status: orders.status, customerId: orders.customerId, number: orders.number })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!o) throw new DeliveryError("El pedido no existe");
      if (o.status !== "PENDIENTE") throw new DeliveryError("El pedido ya no está pendiente");
      const items = await tx
        .select({
          id: orderItems.id,
          packagingId: orderItems.packagingId,
          quantity: orderItems.quantity,
          price: orderItems.price,
          factor: packagings.factor,
          productId: packagings.productId,
          productName: products.name,
        })
        .from(orderItems)
        .innerJoin(packagings, eq(packagings.id, orderItems.packagingId))
        .innerJoin(products, eq(products.id, packagings.productId))
        .where(eq(orderItems.orderId, orderId));
      if (items.length !== deliveredOf.size || items.some((i) => !deliveredOf.has(i.packagingId)))
        throw new DeliveryError("El pedido cambió; recarga la página");
      const delivered = items.map((i) => ({ ...i, delivered: deliveredOf.get(i.packagingId)! }));
      const over = delivered.find((i) => i.delivered > i.quantity);
      if (over) throw new DeliveryError(`No puedes entregar más de lo pedido en ${over.productName}`);
      const total = delivered.reduce((s, i) => s + i.delivered * i.price, 0);
      if (!delivered.some((i) => i.delivered > 0)) throw new DeliveryError("No hay nada que entregar; anula el pedido");

      // Base units per product, dispatched in product id order (same lock order as receiveGoods).
      const perProduct = new Map<string, { qty: number; name: string }>();
      for (const i of delivered) {
        const p = perProduct.get(i.productId) ?? { qty: 0, name: i.productName };
        p.qty += toBaseUnits(i.delivered, i.factor);
        perProduct.set(i.productId, p);
      }
      for (const [productId, p] of [...perProduct].sort(([a], [b]) => a.localeCompare(b))) {
        if (!p.qty) continue;
        const r = await dispatchStock(tx, { productId, baseQty: p.qty, orderId, userId: me.id });
        if (!r.ok) {
          const packs = await tx
            .select({ name: packagings.name, factor: packagings.factor })
            .from(packagings)
            .where(eq(packagings.productId, productId))
            .orderBy(asc(packagings.factor));
          throw new DeliveryError(`Falta stock de ${p.name}: hay ${r.available ? formatQty(r.available, packs) : "0"}`);
        }
      }

      for (const i of delivered) await tx.update(orderItems).set({ delivered: i.delivered }).where(eq(orderItems.id, i.id));
      await tx.update(orders).set({ status: "ENTREGADO", total, deliveredAt: new Date() }).where(eq(orders.id, orderId));

      const balance = (await lockedBalance(tx, o.customerId)) ?? 0;
      const maxPaid = Math.max(0, balance + total);
      if (paid > maxPaid) throw new DeliveryError(`Lo pagado no puede pasar de ${formatSoles(maxPaid)}`);
      if (total > 0) await addCharge(tx, { customerId: o.customerId, orderId, amount: total, userId: me.id });
      if (paid > 0) await addPayment(tx, { customerId: o.customerId, amount: paid, method, userId: me.id });
      await audit(tx, {
        actorId: me.id,
        action: "order.deliver",
        entity: "order",
        entityId: orderId,
        details: { total, paid, method: paid ? method : null },
      });
    });
  } catch (e) {
    if (e instanceof DeliveryError) return { error: e.message };
    throw e;
  }
  revalidatePath("/pedidos");
  revalidatePath("/deudores");
  redirect(`/pedidos/${orderId}`);
}
