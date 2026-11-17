"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { audit, db, isUniqueViolation, type Tx } from "@/server/db";
import { customerPrices, customers, packagings, routes } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { customerSchema, routeSchema, specialPriceSchema } from "./schemas";

export async function saveRoute(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = routeSchema.safeParse({ id: form.get("id") ?? "", name: form.get("name"), days: form.getAll("days") });
  if (!input.success) return { error: input.error.issues[0].message };
  const { id, name, days } = input.data;
  try {
    await db.transaction(async (tx) => {
      let routeId = id;
      if (routeId) {
        const updated = await tx.update(routes).set({ name, days }).where(eq(routes.id, routeId)).returning({ id: routes.id });
        if (!updated.length) throw new Error("Ruta no existe");
      } else [{ id: routeId }] = await tx.insert(routes).values({ name, days }).returning({ id: routes.id });
      await audit(tx, { actorId: me.id, action: id ? "route.update" : "route.create", entity: "route", entityId: routeId, details: { name, days } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Ya existe la ruta "${name}"` };
    if (e instanceof Error && e.message === "Ruta no existe") return { error: "La ruta no existe" };
    throw e;
  }
  revalidatePath("/rutas");
  revalidatePath("/clientes");
  return { ok: id ? "Ruta guardada" : `Ruta "${name}" creada` };
}

/** Serializes ordering changes of these routes. One lock per id in sorted order, so two saves never deadlock. */
async function lockRoutes(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.execute(sql`select 1 from rutas where id = ${id} for update`);
}

const nextOrder = async (tx: Tx, routeId: string) => {
  const [r] = await tx
    .select({ n: max(customers.routeOrder) })
    .from(customers)
    .where(and(eq(customers.routeId, routeId), eq(customers.active, true)));
  return (r?.n ?? 0) + 1;
};

/** Closes the gap left by a customer that leaves the route's active order. */
const closeGap = (tx: Tx, routeId: string, order: number) =>
  tx
    .update(customers)
    .set({ routeOrder: sql`${customers.routeOrder} - 1` })
    .where(and(eq(customers.routeId, routeId), eq(customers.active, true), gt(customers.routeOrder, order)));

export async function saveCustomer(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = customerSchema.safeParse({ active: "true", ...Object.fromEntries(form) });
  if (!input.success) return { error: input.error.issues[0].message };
  const { id, ...c } = input.data;

  const [route] = await db.select({ id: routes.id }).from(routes).where(eq(routes.id, c.routeId));
  if (!route) return { error: "La ruta no existe" };

  let customerId = id;
  let repeated = false;
  const result = await db.transaction(async (tx) => {
    // Route locks first, as in moveCustomer, so the two never wait on each other in opposite order.
    const [prev] = id ? await tx.select({ routeId: customers.routeId }).from(customers).where(eq(customers.id, id)) : [];
    if (id && !prev) return "missing";
    await lockRoutes(tx, prev ? [prev.routeId, c.routeId] : [c.routeId]);
    const [old] = id ? await tx.select().from(customers).where(eq(customers.id, id)) : [];
    if (old && old.routeId !== prev.routeId) return "changed"; // moved by another save between the read and the lock

    // Leaves its old place when it changes route or is deactivated; joins at the end when it enters a route's active order.
    const wasIn = old?.active ? old.routeId : null;
    const isIn = c.active ? c.routeId : null;
    let routeOrder = old?.routeOrder ?? 0;
    if (wasIn !== isIn) {
      if (wasIn) await closeGap(tx, wasIn, old!.routeOrder);
      routeOrder = isIn ? await nextOrder(tx, isIn) : 0;
    }
    const values = { ...c, routeOrder };
    if (old) await tx.update(customers).set(values).where(eq(customers.id, old.id));
    else [{ id: customerId }] = await tx.insert(customers).values(values).returning({ id: customers.id });

    const [dup] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.routeId, c.routeId),
          eq(customers.active, true),
          ne(customers.id, customerId!),
          sql`lower(${customers.name}) = lower(${c.name})`,
        ),
      )
      .limit(1);
    repeated = c.active && !!dup;
    await audit(tx, { actorId: me.id, action: id ? "customer.update" : "customer.create", entity: "customer", entityId: customerId });
    return "ok";
  });
  if (result === "missing") return { error: "El cliente no existe" };
  if (result === "changed") return { error: "El cliente cambió mientras guardabas; vuelve a intentar" };
  revalidatePath("/clientes");
  revalidatePath("/rutas");
  redirect(`/clientes?ruta=${c.routeId}${repeated ? `&repetido=${encodeURIComponent(c.name)}` : ""}`);
}

/** Swaps a customer with its neighbor in the route's visit order. */
export async function moveCustomer(form: FormData) {
  const me = await requireUser("DUENO");
  const input = z.object({ id: z.uuid(), dir: z.enum(["up", "down"]) }).safeParse(Object.fromEntries(form));
  if (!input.success) return;
  const { id, dir } = input.data;
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(customers).where(eq(customers.id, id));
    if (!c?.active) return;
    await lockRoutes(tx, [c.routeId]);
    const [cur] = await tx
      .select({ order: customers.routeOrder, routeId: customers.routeId, active: customers.active })
      .from(customers)
      .where(eq(customers.id, id));
    if (!cur.active || cur.routeId !== c.routeId) return; // changed before the lock
    const target = cur.order + (dir === "up" ? -1 : 1);
    const [other] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.routeId, c.routeId), eq(customers.active, true), eq(customers.routeOrder, target)));
    if (!other) return;
    await tx.update(customers).set({ routeOrder: cur.order }).where(eq(customers.id, other.id));
    await tx.update(customers).set({ routeOrder: target }).where(eq(customers.id, id));
    await audit(tx, { actorId: me.id, action: "customer.reorder", entity: "customer", entityId: id, details: { from: cur.order, to: target } });
  });
  revalidatePath("/clientes");
}

/** Sets (or replaces) the customer's price for a packaging. */
export async function saveSpecialPrice(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = specialPriceSchema.safeParse({
    customerId: form.get("customerId"),
    packagingId: form.get("packagingId"),
    price: form.get("price") ?? "",
  });
  if (!input.success) return { error: input.error.issues[0].message };
  const { customerId, packagingId, price } = input.data;
  const result = await db.transaction(async (tx) => {
    const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId));
    const [p] = await tx.select({ id: packagings.id }).from(packagings).where(eq(packagings.id, packagingId));
    if (!c || !p) return "missing";
    const [prev] = await tx
      .select({ price: customerPrices.price })
      .from(customerPrices)
      .where(and(eq(customerPrices.customerId, customerId), eq(customerPrices.packagingId, packagingId)))
      .for("update");
    await tx
      .insert(customerPrices)
      .values({ customerId, packagingId, price })
      .onConflictDoUpdate({ target: [customerPrices.customerId, customerPrices.packagingId], set: { price } });
    await audit(tx, {
      actorId: me.id,
      action: "customer_price.set",
      entity: "customer",
      entityId: customerId,
      details: { packagingId, price, previous: prev?.price ?? null },
    });
    return "ok";
  });
  if (result === "missing") return { error: "El cliente o la presentación no existe" };
  revalidatePath(`/clientes/${customerId}`);
  return { ok: "Precio especial guardado" };
}

export async function deleteSpecialPrice(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = specialPriceSchema.pick({ customerId: true, packagingId: true }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { customerId, packagingId } = input.data;
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(customerPrices)
      .where(and(eq(customerPrices.customerId, customerId), eq(customerPrices.packagingId, packagingId)))
      .returning({ price: customerPrices.price });
    if (row)
      await audit(tx, {
        actorId: me.id,
        action: "customer_price.delete",
        entity: "customer",
        entityId: customerId,
        details: { packagingId, price: row.price },
      });
    return row;
  });
  if (!deleted) return { error: "Ese precio especial ya no existe" };
  revalidatePath(`/clientes/${customerId}`);
  return { ok: "Precio especial quitado" };
}
