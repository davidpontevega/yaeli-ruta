import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/server/db";
import { accountMovements, customers, type PaymentMethod } from "@/server/db/schema";
import { todayInLima } from "@/modules/inventory";
import type { PAYMENT_METHOD_IDS } from "@/lib/payment";

// Compile-time check: the shared list and the DB enum stay equal.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const methodsMatch: Same<(typeof PAYMENT_METHOD_IDS)[number], PaymentMethod> = true;
void methodsMatch;

/** Locks the customer row (serializes payments/charges of that customer) and returns its balance; null if it doesn't exist. */
export async function lockedBalance(tx: Tx, customerId: string) {
  const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).for("update");
  if (!c) return null;
  const [r] = await tx
    .select({ balance: sql`coalesce(sum(${accountMovements.amount}), 0)`.mapWith(Number) })
    .from(accountMovements)
    .where(eq(accountMovements.customerId, customerId));
  return r.balance;
}

/** Delivery charge (amount > 0), dated today. */
export const addCharge = (tx: Tx, c: { customerId: string; orderId: string; amount: number; userId: string }) =>
  tx
    .insert(accountMovements)
    .values({ customerId: c.customerId, type: "CARGO", amount: c.amount, date: todayInLima(), orderId: c.orderId, userId: c.userId });

/** Payment (amount > 0, stored negative), dated today. `sheetId` = taken on the road with that sheet. Callers check it doesn't exceed the balance. */
export const addPayment = (tx: Tx, p: { customerId: string; amount: number; method: PaymentMethod; userId: string; sheetId?: string }) =>
  tx.insert(accountMovements).values({
    customerId: p.customerId,
    type: "ABONO",
    amount: -p.amount,
    date: todayInLima(),
    method: p.method,
    userId: p.userId,
    sheetId: p.sheetId,
  });
