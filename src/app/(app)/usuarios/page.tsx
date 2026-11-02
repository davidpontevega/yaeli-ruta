import { asc, count, eq, gt, and } from "drizzle-orm";
import { db } from "@/server/db";
import { sesiones, usuarios } from "@/server/db/schema";
import { requerirUsuario } from "@/server/auth";
import { cambiarActivo, cerrarSesiones } from "./actions";
import { CambiarPinForm, NuevoUsuarioForm } from "./forms";

const ROL = { DUENO: "Dueño", REPARTIDOR: "Repartidor" } as const;

export default async function UsuariosPage() {
  const yo = await requerirUsuario("DUENO");
  const ahora = new Date();
  const lista = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      activo: usuarios.activo,
      bloqueadoHasta: usuarios.bloqueadoHasta,
      sesiones: count(sesiones.id),
    })
    .from(usuarios)
    .leftJoin(sesiones, and(eq(sesiones.usuarioId, usuarios.id), gt(sesiones.expiraEn, ahora)))
    .groupBy(usuarios.id)
    .orderBy(asc(usuarios.nombre));

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      <ul className="flex flex-col gap-3">
        {lista.map((u) => (
          <li key={u.id} className={`tarjeta flex flex-col gap-3 ${u.activo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{u.nombre}</p>
                <p className="text-sm text-muted">
                  {ROL[u.rol]} · {u.sesiones} {u.sesiones === 1 ? "celular conectado" : "celulares conectados"}
                  {!u.activo && " · Desactivado"}
                  {u.bloqueadoHasta && u.bloqueadoHasta > ahora && " · Bloqueado por intentos"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CambiarPinForm usuarioId={u.id} />
              {u.sesiones > 0 && (
                <form action={cerrarSesiones}>
                  <input type="hidden" name="usuarioId" value={u.id} />
                  <button className="btn-secundario h-10 text-sm">Cerrar sesiones</button>
                </form>
              )}
              {u.id !== yo.id && (
                <form action={cambiarActivo}>
                  <input type="hidden" name="usuarioId" value={u.id} />
                  <input type="hidden" name="activo" value={String(!u.activo)} />
                  <button className="btn-secundario h-10 text-sm">{u.activo ? "Desactivar" : "Activar"}</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      <NuevoUsuarioForm />
    </section>
  );
}
