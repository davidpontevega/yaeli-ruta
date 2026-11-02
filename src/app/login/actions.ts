"use server";

import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { auditar, db } from "@/server/db";
import { usuarios } from "@/server/db/schema";
import { cerrarSesion, crearSesion } from "@/server/auth";
import { PIN_REGEX, hashPin, trasFallo, verificarPin } from "@/lib/pin";

export type Estado = { error?: string } | undefined;

const pin = z.string().regex(PIN_REGEX, "El PIN debe tener de 4 a 6 números");

export async function entrar(_: Estado, form: FormData): Promise<Estado> {
  const datos = z.object({ usuarioId: z.uuid(), pin }).safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: "PIN incorrecto" };
  const { usuarioId } = datos.data;

  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  if (!u || !u.activo) return { error: "Usuario no disponible" };

  const ahora = new Date();
  if (u.bloqueadoHasta && u.bloqueadoHasta > ahora) {
    const min = Math.ceil((u.bloqueadoHasta.getTime() - ahora.getTime()) / 60000);
    return { error: `Demasiados intentos. Prueba de nuevo en ${min} min.` };
  }

  if (!(await verificarPin(datos.data.pin, u.pinHash))) {
    const nuevo = trasFallo(u.intentosFallidos, ahora);
    await db.update(usuarios).set(nuevo).where(eq(usuarios.id, u.id));
    if (nuevo.bloqueadoHasta) {
      await auditar(db, { actorId: u.id, accion: "login.bloqueado", entidad: "usuario", entidadId: u.id });
      return { error: "Demasiados intentos. Usuario bloqueado 15 min." };
    }
    return { error: "PIN incorrecto" };
  }

  await db.update(usuarios).set({ intentosFallidos: 0, bloqueadoHasta: null }).where(eq(usuarios.id, u.id));
  await crearSesion(u.id);
  await auditar(db, { actorId: u.id, accion: "login", entidad: "usuario", entidadId: u.id });
  redirect("/");
}

/** Solo funciona mientras no exista ningún usuario: crea al dueño en el primer arranque. */
export async function crearDueno(_: Estado, form: FormData): Promise<Estado> {
  const datos = z
    .object({ nombre: z.string().trim().min(2, "Escribe tu nombre").max(40), pin, pin2: z.string() })
    .refine((d) => d.pin === d.pin2, { message: "Los PIN no coinciden" })
    .safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const pinHash = await hashPin(datos.data.pin);
  const id = await db.transaction(async (tx) => {
    // Serializa dos intentos simultáneos de crear el primer dueño.
    await tx.execute("select pg_advisory_xact_lock(1)");
    const [{ n }] = await tx.select({ n: count() }).from(usuarios);
    if (n > 0) return null;
    const [u] = await tx
      .insert(usuarios)
      .values({ nombre: datos.data.nombre, rol: "DUENO", pinHash })
      .returning({ id: usuarios.id });
    await auditar(tx, { actorId: u.id, accion: "usuario.crear_dueno", entidad: "usuario", entidadId: u.id });
    return u.id;
  });
  if (!id) return { error: "Ya existe un dueño. Ingresa con tu usuario." };

  await crearSesion(id);
  redirect("/");
}

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
