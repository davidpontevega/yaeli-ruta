import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");

// Pool (WebSocket), not neon-http: stock, orders and payments need db.transaction.
export const db = drizzle(new Pool({ connectionString: url }), { schema });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Appends to the audit log. Pass the mutation's tx so both commit together. */
export async function audit(
  tx: typeof db | Tx,
  e: { actorId: string | null; action: string; entity: string; entityId?: string; details?: Record<string, unknown> },
) {
  await tx.insert(schema.auditLog).values(e);
}

const pgCode = (e: unknown) => (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;

/** Postgres UNIQUE violation (23505), wrapped by Drizzle or not. */
export const isUniqueViolation = (e: unknown) => pgCode(e) === "23505";

/** Postgres FOREIGN KEY violation (23503): the row is still referenced. */
export const isForeignKeyViolation = (e: unknown) => pgCode(e) === "23503";
