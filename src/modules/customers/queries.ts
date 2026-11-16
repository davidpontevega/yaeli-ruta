import "server-only";
import { and, asc, count, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { customers, routes } from "@/server/db/schema";

/** Lowercase without accents, same as the SQL `translate` below. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function listRoutes() {
  return db
    .select({ id: routes.id, name: routes.name, days: routes.days, customers: count(customers.id) })
    .from(routes)
    .leftJoin(customers, and(eq(customers.routeId, routes.id), eq(customers.active, true)))
    .groupBy(routes.id)
    .orderBy(asc(routes.name));
}
export type RouteRow = Awaited<ReturnType<typeof listRoutes>>[number];

/** `q` matches the name (ignoring case and accents) or the phone digits. */
export async function listCustomers(f: { q: string; routeId: string; includeInactive: boolean }) {
  const where: (SQL | undefined)[] = [f.includeInactive ? undefined : eq(customers.active, true)];
  if (f.routeId) where.push(eq(customers.routeId, f.routeId));
  if (f.q) {
    const esc = (v: string) => v.replace(/[%_\\]/g, "\\$&"); // LIKE wildcards typed by the user match literally
    const digits = f.q.replace(/\D/g, "");
    where.push(
      or(
        like(sql`translate(lower(${customers.name}), 'áéíóúüñ', 'aeiouun')`, `%${esc(fold(f.q))}%`),
        digits ? like(customers.phone, `%${digits}%`) : undefined,
      ),
    );
  }
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
      routeId: customers.routeId,
      routeName: routes.name,
      routeOrder: customers.routeOrder,
      active: customers.active,
    })
    .from(customers)
    .innerJoin(routes, eq(routes.id, customers.routeId))
    .where(and(...where))
    .orderBy(asc(routes.name), sql`${customers.active} desc`, asc(customers.routeOrder), asc(customers.name));
}
export type CustomerRow = Awaited<ReturnType<typeof listCustomers>>[number];

export async function getCustomer(id: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return c ?? null;
}
