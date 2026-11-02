"use server";

import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { audit, db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createSession, destroySession } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { PIN_REGEX, afterFailedAttempt, hashPin, verifyPin } from "./pin";

const pin = z.string().regex(PIN_REGEX, "El PIN debe tener de 4 a 6 números");

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const input = z.object({ userId: z.uuid(), pin }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "PIN incorrecto" };

  const [u] = await db.select().from(users).where(eq(users.id, input.data.userId)).limit(1);
  if (!u || !u.active) return { error: "Usuario no disponible" };

  const now = new Date();
  if (u.lockedUntil && u.lockedUntil > now) {
    const min = Math.ceil((u.lockedUntil.getTime() - now.getTime()) / 60000);
    return { error: `Demasiados intentos. Prueba de nuevo en ${min} min.` };
  }

  if (!(await verifyPin(input.data.pin, u.pinHash))) {
    const next = afterFailedAttempt(u.failedAttempts, now);
    await db.update(users).set(next).where(eq(users.id, u.id));
    if (next.lockedUntil) {
      await audit(db, { actorId: u.id, action: "login.locked", entity: "user", entityId: u.id });
      return { error: "Demasiados intentos. Usuario bloqueado 15 min." };
    }
    return { error: "PIN incorrecto" };
  }

  await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, u.id));
  await createSession(u.id);
  await audit(db, { actorId: u.id, action: "login", entity: "user", entityId: u.id });
  redirect("/");
}

/** Only works while no user exists: creates the owner on first run. */
export async function createFirstOwner(_: FormState, form: FormData): Promise<FormState> {
  const input = z
    .object({ name: z.string().trim().min(2, "Escribe tu nombre").max(40), pin, pin2: z.string() })
    .refine((d) => d.pin === d.pin2, { message: "Los PIN no coinciden" })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };

  const pinHash = await hashPin(input.data.pin);
  const id = await db.transaction(async (tx) => {
    // Serializes two simultaneous attempts to create the first owner.
    await tx.execute("select pg_advisory_xact_lock(1)");
    const [{ n }] = await tx.select({ n: count() }).from(users);
    if (n > 0) return null;
    const [u] = await tx.insert(users).values({ name: input.data.name, role: "DUENO", pinHash }).returning({ id: users.id });
    await audit(tx, { actorId: u.id, action: "user.create_owner", entity: "user", entityId: u.id });
    return u.id;
  });
  if (!id) return { error: "Ya existe un dueño. Ingresa con tu usuario." };

  await createSession(id);
  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
