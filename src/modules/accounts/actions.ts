"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { audit, db, type Tx } from "@/server/db";
import { accountMovements, customers } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { formatSoles } from "@/lib/money";
import { todayInLima } from "@/modules/inventory";
import { adjustmentSchema, initialDebtsSchema, paymentSchema } from "./schemas";

const refresh = (customerId?: string) => {
  revalidatePath("/deudores", "layout");
  revalidatePath("/clientes");
  if (customerId) revalidatePath(`/clientes/${customerId}/cuenta`);
};

/** Locks the customer row so concurrent payments/adjustments see each other's result; returns the current balance or null. */
async function lockedBalance(tx: Tx, customerId: string) {
  const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).for("update");
  if (!c) return null;
  const [r] = await tx
    .select({ balance: sql`coalesce(sum(${accountMovements.amount}), 0)`.mapWith(Number) })
    .from(accountMovements)
    .where(eq(accountMovements.customerId, customerId));
  return r.balance;
}

/** Form fields: `date` and one `amount_<customerId>` per row; empty rows are skipped. */
export async function saveInitialDebts(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const items = [...form.entries()]
    .filter(([k, v]) => k.startsWith("amount_") && String(v).trim() !== "")
    .map(([k, v]) => ({ customerId: k.slice(7), amount: String(v) }));
  const input = initialDebtsSchema.safeParse({ date: form.get("date"), items });
  if (!input.success) return { error: input.error.issues[0].message };
  const { date } = input.data;
  if (date > todayInLima()) return { error: "La fecha no puede ser futura" };

  const saved = await db.transaction(async (tx) => {
    // Only active customers; the unique partial index allows one initial debt per customer (a repeated one is skipped).
    const active = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          inArray(
            customers.id,
            input.data.items.map((i) => i.customerId),
          ),
          eq(customers.active, true),
        ),
      );
    const ids = new Set(active.map((c) => c.id));
    const items = input.data.items.filter((i) => ids.has(i.customerId));
    if (!items.length) return 0;
    const rows = await tx
      .insert(accountMovements)
      .values(items.map((i) => ({ customerId: i.customerId, type: "SALDO_INICIAL" as const, amount: i.amount, date, userId: me.id })))
      .onConflictDoNothing()
      .returning({ customerId: accountMovements.customerId, amount: accountMovements.amount });
    for (const r of rows)
      await audit(tx, {
        actorId: me.id,
        action: "account.initial",
        entity: "customer",
        entityId: r.customerId,
        details: { amount: r.amount, date },
      });
    return rows.length;
  });
  refresh();
  return { ok: `Deuda inicial guardada para ${saved} cliente${saved === 1 ? "" : "s"}` };
}

export async function registerPayment(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = paymentSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { customerId, amount, method } = input.data;
  const error = await db.transaction(async (tx) => {
    const balance = await lockedBalance(tx, customerId);
    if (balance === null) return "El cliente no existe";
    if (amount > balance) return balance > 0 ? `El cliente debe ${formatSoles(balance)}` : "El cliente no tiene deuda";
    await tx.insert(accountMovements).values({ customerId, type: "ABONO", amount: -amount, date: todayInLima(), method, userId: me.id });
    await audit(tx, { actorId: me.id, action: "account.payment", entity: "customer", entityId: customerId, details: { amount, method } });
    return null;
  });
  if (error) return { error };
  refresh(customerId);
  return { ok: `Cobro de ${formatSoles(amount)} registrado` };
}

export async function adjustBalance(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = adjustmentSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { customerId, amount, note } = input.data;
  const error = await db.transaction(async (tx) => {
    const balance = await lockedBalance(tx, customerId);
    if (balance === null) return "El cliente no existe";
    if (balance + amount < 0) return `El saldo no puede quedar negativo (debe ${formatSoles(balance)})`;
    await tx.insert(accountMovements).values({ customerId, type: "AJUSTE", amount, date: todayInLima(), note, userId: me.id });
    await audit(tx, { actorId: me.id, action: "account.adjust", entity: "customer", entityId: customerId, details: { amount, note } });
    return null;
  });
  if (error) return { error };
  refresh(customerId);
  return { ok: "Ajuste registrado" };
}
