import "server-only";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { accountMovements, customers, orders, routes } from "@/server/db/schema";
import { daysUntil, todayInLima } from "@/modules/inventory";
import { debtSince } from "./account-math";

export const ACCOUNT_MOVEMENT_LIMIT = 100;
const balance = sql`sum(${accountMovements.amount})`.mapWith(Number);

/** Balance per customer (only customers with movements). */
export async function balancesByCustomer(customerIds?: string[]): Promise<Record<string, number>> {
  if (customerIds && !customerIds.length) return {};
  const rows = await db
    .select({ id: accountMovements.customerId, balance })
    .from(accountMovements)
    .where(customerIds ? inArray(accountMovements.customerId, customerIds) : undefined)
    .groupBy(accountMovements.customerId);
  return Object.fromEntries(rows.map((r) => [r.id, r.balance]));
}

const ageDays = (since: string | null) => (since ? -daysUntil(since, todayInLima()) : null);

/** Balance, debt age and the last movements (newest first) with the balance after each one. */
export async function getAccount(customerId: string) {
  // ponytail: reads every movement of the customer (needed for FIFO age). Fine for thousands per customer.
  const all = await db
    .select({
      id: accountMovements.id,
      type: accountMovements.type,
      amount: accountMovements.amount,
      date: accountMovements.date,
      method: accountMovements.method,
      note: accountMovements.note,
      orderNumber: orders.number,
    })
    .from(accountMovements)
    .leftJoin(orders, eq(orders.id, accountMovements.orderId))
    .where(eq(accountMovements.customerId, customerId))
    .orderBy(asc(accountMovements.date), asc(accountMovements.createdAt));
  let running = 0;
  const withBalance = all.map((m) => ({ ...m, balance: (running += m.amount) }));
  return {
    balance: running,
    ageDays: running > 0 ? ageDays(debtSince(all)) : null,
    movements: withBalance.reverse().slice(0, ACCOUNT_MOVEMENT_LIMIT),
  };
}
export type Account = Awaited<ReturnType<typeof getAccount>>;

/** Customers who owe, oldest debt first. */
export async function listDebtors(f: { routeId: string }) {
  const where: (SQL | undefined)[] = [f.routeId ? eq(customers.routeId, f.routeId) : undefined];
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      creditLimit: customers.creditLimit,
      routeName: routes.name,
      balance,
    })
    .from(accountMovements)
    .innerJoin(customers, eq(customers.id, accountMovements.customerId))
    .innerJoin(routes, eq(routes.id, customers.routeId))
    .where(and(...where))
    .groupBy(customers.id, routes.id)
    .having(sql`sum(${accountMovements.amount}) > 0`);
  if (!rows.length) return [];
  const moves = await db
    .select({ customerId: accountMovements.customerId, amount: accountMovements.amount, date: accountMovements.date })
    .from(accountMovements)
    .where(
      inArray(
        accountMovements.customerId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(accountMovements.date), asc(accountMovements.createdAt));
  const byCustomer = Map.groupBy(moves, (m) => m.customerId);
  return rows
    .map((r) => ({ ...r, ageDays: ageDays(debtSince(byCustomer.get(r.id) ?? [])) ?? 0 }))
    .sort((a, b) => b.ageDays - a.ageDays || b.balance - a.balance);
}
export type Debtor = Awaited<ReturnType<typeof listDebtors>>[number];

/** Active customers without an initial debt yet, by route and visit order. */
export function listWithoutInitialDebt(f: { routeId: string }) {
  const hasInitial = sql`exists (select 1 from ${accountMovements} where ${accountMovements.customerId} = ${customers.id} and ${accountMovements.type} = 'SALDO_INICIAL')`;
  return db
    .select({ id: customers.id, name: customers.name, routeName: routes.name })
    .from(customers)
    .innerJoin(routes, eq(routes.id, customers.routeId))
    .where(and(eq(customers.active, true), sql`not ${hasInitial}`, f.routeId ? eq(customers.routeId, f.routeId) : undefined))
    .orderBy(asc(routes.name), asc(customers.routeOrder));
}
export type InitialDebtRow = Awaited<ReturnType<typeof listWithoutInitialDebt>>[number];
