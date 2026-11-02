"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditar, db } from "@/server/db";
import { rolEnum, sesiones, usuarios } from "@/server/db/schema";
import { requerirUsuario } from "@/server/auth";
import { PIN_REGEX, hashPin } from "@/lib/pin";

export type Estado = { error?: string; ok?: string } | undefined;

const pin = z.string().regex(PIN_REGEX, "El PIN debe tener de 4 a 6 números");

export async function crearUsuario(_: Estado, form: FormData): Promise<Estado> {
  const yo = await requerirUsuario("DUENO");
  const d = z
    .object({ nombre: z.string().trim().min(2, "Nombre muy corto").max(40), rol: z.enum(rolEnum.enumValues), pin })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };

  const pinHash = await hashPin(d.data.pin);
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(usuarios)
        .values({ nombre: d.data.nombre, rol: d.data.rol, pinHash })
        .returning({ id: usuarios.id });
      await auditar(tx, { actorId: yo.id, accion: "usuario.crear", entidad: "usuario", entidadId: u.id, detalles: { rol: d.data.rol } });
    });
  } catch (e) {
    // 23505 = unique_violation (nombre repetido)
    if ((e as { cause?: { code?: string } }).cause?.code === "23505") return { error: "Ya existe un usuario con ese nombre" };
    throw e;
  }
  revalidatePath("/usuarios");
  return { ok: `Usuario ${d.data.nombre} creado` };
}

export async function cambiarPin(_: Estado, form: FormData): Promise<Estado> {
  const yo = await requerirUsuario("DUENO");
  const d = z.object({ usuarioId: z.uuid(), pin }).safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };

  const pinHash = await hashPin(d.data.pin);
  await db.transaction(async (tx) => {
    await tx.update(usuarios).set({ pinHash, intentosFallidos: 0, bloqueadoHasta: null }).where(eq(usuarios.id, d.data.usuarioId));
    await auditar(tx, { actorId: yo.id, accion: "usuario.cambiar_pin", entidad: "usuario", entidadId: d.data.usuarioId });
  });
  revalidatePath("/usuarios");
  return { ok: "PIN actualizado" };
}

/** Desactivar también cierra todas sus sesiones: el celular pierde acceso al instante. */
export async function cambiarActivo(form: FormData) {
  const yo = await requerirUsuario("DUENO");
  const d = z.object({ usuarioId: z.uuid(), activo: z.enum(["true", "false"]) }).parse(Object.fromEntries(form));
  if (d.usuarioId === yo.id) return; // el dueño no se bloquea a sí mismo
  const activo = d.activo === "true";

  await db.transaction(async (tx) => {
    await tx.update(usuarios).set({ activo }).where(eq(usuarios.id, d.usuarioId));
    if (!activo) await tx.delete(sesiones).where(eq(sesiones.usuarioId, d.usuarioId));
    await auditar(tx, { actorId: yo.id, accion: activo ? "usuario.activar" : "usuario.desactivar", entidad: "usuario", entidadId: d.usuarioId });
  });
  revalidatePath("/usuarios");
}

export async function cerrarSesiones(form: FormData) {
  const yo = await requerirUsuario("DUENO");
  const { usuarioId } = z.object({ usuarioId: z.uuid() }).parse(Object.fromEntries(form));

  await db.transaction(async (tx) => {
    await tx.delete(sesiones).where(eq(sesiones.usuarioId, usuarioId));
    await auditar(tx, { actorId: yo.id, accion: "usuario.cerrar_sesiones", entidad: "usuario", entidadId: usuarioId });
  });
  revalidatePath("/usuarios");
}
