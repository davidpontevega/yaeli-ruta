import "server-only";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { audit, db } from "@/server/db";
import { auditLog } from "@/server/db/schema";

const RATE = { max: 20, windowMs: 10 * 60 * 1000 };

/**
 * Reserves one document reading for the user, or false if over the limit.
 * Per-user advisory lock so parallel requests can't skip it; counted in `auditoria` because Vercel instances share no memory.
 */
export function reserveReadSlot(userId: string, mime: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(auditLog)
      .where(and(eq(auditLog.actorId, userId), eq(auditLog.action, "document.read"), gt(auditLog.createdAt, new Date(Date.now() - RATE.windowMs))));
    if (n >= RATE.max) return false;
    await audit(tx, { actorId: userId, action: "document.read", entity: "receipt", details: { type: mime } });
    return true;
  });
}

/** Line count of a successful reading. Best effort: a failed log must not lose a reading the user already waited for. */
export async function recordReadResult(userId: string, lines: number) {
  try {
    await audit(db, { actorId: userId, action: "document.read_result", entity: "receipt", details: { lines } });
  } catch (e) {
    console.error("audit document.read_result failed", (e as Error).name);
  }
}
