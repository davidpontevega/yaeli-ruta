import { asc, count, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { categorias, marcas, productos, ubicaciones } from "@/server/db/schema";
import { requerirUsuario } from "@/server/auth";
import { AgregarForm } from "./agregar-form";

export default async function CatalogoPage() {
  await requerirUsuario("DUENO");
  const [cats, mars, ubis] = await Promise.all([
    db
      .select({ id: categorias.id, nombre: categorias.nombre, n: count(productos.id) })
      .from(categorias)
      .leftJoin(productos, eq(productos.categoriaId, categorias.id))
      .groupBy(categorias.id)
      .orderBy(asc(categorias.nombre)),
    db
      .select({ id: marcas.id, nombre: marcas.nombre, n: count(productos.id) })
      .from(marcas)
      .leftJoin(productos, eq(productos.marcaId, marcas.id))
      .groupBy(marcas.id)
      .orderBy(asc(marcas.nombre)),
    db.select().from(ubicaciones).orderBy(asc(ubicaciones.tipo), asc(ubicaciones.nombre)),
  ]);

  const bloques = [
    { tipo: "categoria", titulo: "Categorías", filas: cats.map((c) => ({ id: c.id, texto: c.nombre, extra: `${c.n} productos` })) },
    { tipo: "marca", titulo: "Marcas", filas: mars.map((m) => ({ id: m.id, texto: m.nombre, extra: `${m.n} productos` })) },
    {
      tipo: "ubicacion",
      titulo: "Ubicaciones (pisos y vehículos)",
      filas: ubis.map((u) => ({ id: u.id, texto: u.nombre, extra: u.tipo === "ALMACEN" ? "Almacén" : "Vehículo" })),
    },
  ] as const;

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Catálogo</h1>
      {bloques.map((b) => (
        <div key={b.tipo} className="tarjeta flex flex-col gap-3">
          <h2 className="font-semibold">{b.titulo}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {b.filas.map((f) => (
              <li key={f.id} className="rounded-lg bg-slate-100 px-2 py-1">
                {f.texto} <span className="text-muted">· {f.extra}</span>
              </li>
            ))}
          </ul>
          <AgregarForm tipo={b.tipo} />
        </div>
      ))}
    </section>
  );
}
