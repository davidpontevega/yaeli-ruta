import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { sesiones, usuarios, type Rol } from "./db/schema";

import { COOKIE_SESION } from "./auth-cookie";
const DURACION_MS = 30 * 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type UsuarioActual = { id: string; nombre: string; rol: Rol };

export async function crearSesion(usuarioId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DURACION_MS);
  const dispositivo = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(sesiones).values({ usuarioId, tokenHash: sha256(token), dispositivo, expiraEn });
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEn,
  });
}

export async function cerrarSesion() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESION)?.value;
  if (token) await db.delete(sesiones).where(eq(sesiones.tokenHash, sha256(token)));
  jar.delete(COOKIE_SESION);
}

/** Usuario de la sesión, o null. Verifica en BD que la sesión siga vigente y el usuario activo. */
export const usuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  const [fila] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, rol: usuarios.rol })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.tokenHash, sha256(token)), gt(sesiones.expiraEn, new Date()), eq(usuarios.activo, true)))
    .limit(1);
  return fila ?? null;
});

/** Para páginas y server actions: redirige al login si no hay sesión o no tiene el rol. */
export async function requerirUsuario(...roles: Rol[]): Promise<UsuarioActual> {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.rol)) redirect("/");
  return u;
}
