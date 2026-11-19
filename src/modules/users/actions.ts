"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { audit, db, isUniqueViolation } from "@/server/db";
import { roleEnum, sessions, users } from "@/server/db/schema";
import { requireAdmin, requireUser } from "@/server/auth";
import { sanitizeHidden } from "@/lib/menus";
import type { FormState } from "@/lib/form-state";
import { PIN_REGEX, hashPin } from "@/modules/auth";

const pin = z.string().regex(PIN_REGEX, "El PIN debe tener de 4 a 6 números");

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = z
    .object({ name: z.string().trim().min(2, "Nombre muy corto").max(40), role: z.enum(roleEnum.enumValues), pin })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };

  const pinHash = await hashPin(input.data.pin);
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name: input.data.name, role: input.data.role, pinHash }).returning({ id: users.id });
      await audit(tx, { actorId: me.id, action: "user.create", entity: "user", entityId: u.id, details: { role: input.data.role } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ya existe un usuario con ese nombre" };
    throw e;
  }
  revalidatePath("/usuarios");
  return { ok: `Usuario ${input.data.name} creado` };
}

export async function changePin(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  const input = z.object({ userId: z.uuid(), pin }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };

  const pinHash = await hashPin(input.data.pin);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ pinHash, failedAttempts: 0, lockedUntil: null }).where(eq(users.id, input.data.userId));
    await audit(tx, { actorId: me.id, action: "user.change_pin", entity: "user", entityId: input.data.userId });
  });
  revalidatePath("/usuarios");
  return { ok: "PIN actualizado" };
}

/** Deactivating also deletes all the user's sessions: the phone loses access immediately. */
export async function setUserActive(form: FormData) {
  const me = await requireUser("DUENO");
  const input = z.object({ userId: z.uuid(), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(form));
  if (input.userId === me.id) return; // the owner can't lock themselves out
  const active = input.active === "true";

  await db.transaction(async (tx) => {
    await tx.update(users).set({ active }).where(eq(users.id, input.userId));
    if (!active) await tx.delete(sessions).where(eq(sessions.userId, input.userId));
    await audit(tx, { actorId: me.id, action: active ? "user.activate" : "user.deactivate", entity: "user", entityId: input.userId });
  });
  revalidatePath("/usuarios");
}

export async function revokeSessions(form: FormData) {
  const me = await requireUser("DUENO");
  const { userId } = z.object({ userId: z.uuid() }).parse(Object.fromEntries(form));

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await audit(tx, { actorId: me.id, action: "user.revoke_sessions", entity: "user", entityId: userId });
  });
  revalidatePath("/usuarios");
}

/** Admin only (/menus): which menus a user does not see. Takes effect on that user's next request. */
export async function saveHiddenMenus(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const input = z.object({ userId: z.uuid(), hidden: z.array(z.string()) }).safeParse({ userId: form.get("userId"), hidden: form.getAll("hidden") });
  if (!input.success) return { error: "Datos inválidos" };

  const result = await db.transaction(async (tx): Promise<FormState> => {
    const [u] = await tx
      .select({ role: users.role, isAdmin: users.isAdmin, hiddenMenus: users.hiddenMenus })
      .from(users)
      .where(eq(users.id, input.data.userId))
      .for("update");
    if (!u) return { error: "El usuario no existe" };
    const clean = sanitizeHidden(input.data.hidden, u.role, u.isAdmin);
    if (!clean.ok) return { error: clean.error };
    await tx.update(users).set({ hiddenMenus: clean.hidden }).where(eq(users.id, input.data.userId));
    await audit(tx, {
      actorId: me.id,
      action: "user.set_hidden_menus",
      entity: "user",
      entityId: input.data.userId,
      details: { hidden: clean.hidden, previous: u.hiddenMenus },
    });
    return { ok: "Menús guardados" };
  });
  if (result?.ok) revalidatePath("/menus");
  return result;
}
