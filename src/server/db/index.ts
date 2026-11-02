import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");

// Pool (WebSocket) y no neon-http: stock, pedidos y cobros exigen db.transaction.
export const db = drizzle(new Pool({ connectionString: url }), { schema });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function auditar(
  tx: typeof db | Tx,
  e: { actorId: string | null; accion: string; entidad: string; entidadId?: string; detalles?: Record<string, unknown> },
) {
  await tx.insert(schema.auditoria).values(e);
}

/** Violación de UNIQUE de Postgres (23505), envuelta o no por Drizzle. */
export const esDuplicado = (e: unknown) =>
  (e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505";
