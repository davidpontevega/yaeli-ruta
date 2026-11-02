import Link from "next/link";
import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { categorias, marcas, presentaciones, productos } from "@/server/db/schema";
import { requerirUsuario } from "@/server/auth";
import { formatSoles } from "@/lib/dinero";
import { cambiarActivoProducto } from "./actions";

export default async function ProductosPage({ searchParams }: PageProps<"/productos">) {
  const u = await requerirUsuario();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const verInactivos = sp.inactivos === "1" && u.rol === "DUENO";

  const filtros: (SQL | undefined)[] = [verInactivos ? undefined : eq(productos.activo, true)];
  if (cat) filtros.push(eq(productos.categoriaId, cat));
  if (q) {
    // Busca por nombre, código o código de barras de cualquier presentación.
    const porBarras = db.select({ id: presentaciones.productoId }).from(presentaciones).where(eq(presentaciones.codigoBarras, q));
    filtros.push(or(ilike(productos.nombre, `%${q}%`), ilike(productos.sku, `%${q}%`), inArray(productos.id, porBarras)));
  }

  const [lista, cats] = await Promise.all([
    db
      .select({
        id: productos.id,
        sku: productos.sku,
        nombre: productos.nombre,
        activo: productos.activo,
        categoria: categorias.nombre,
        marca: marcas.nombre,
      })
      .from(productos)
      .innerJoin(categorias, eq(categorias.id, productos.categoriaId))
      .leftJoin(marcas, eq(marcas.id, productos.marcaId))
      .where(and(...filtros))
      .orderBy(asc(categorias.nombre), asc(productos.nombre))
      .limit(200),
    db.select().from(categorias).orderBy(asc(categorias.nombre)),
  ]);

  const pres = lista.length
    ? await db
        .select()
        .from(presentaciones)
        .where(inArray(presentaciones.productoId, lista.map((p) => p.id)))
        .orderBy(asc(presentaciones.factor))
    : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Productos</h1>
        {u.rol === "DUENO" && (
          <Link href="/productos/nuevo" className="btn-primario flex h-10 items-center text-sm">
            + Nuevo
          </Link>
        )}
      </div>

      <form className="flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Buscar nombre, código o escanear" className="h-12 flex-1 rounded-xl border border-border bg-surface px-3" />
        <select name="cat" defaultValue={cat} className="h-12 rounded-xl border border-border bg-surface px-3">
          <option value="">Todas las categorías</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {u.rol === "DUENO" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={verInactivos} /> Inactivos
          </label>
        )}
        <button className="btn-secundario h-12">Buscar</button>
      </form>

      <p className="text-sm text-muted">{lista.length} productos{lista.length === 200 && " (se muestran los primeros 200)"}</p>

      <ul className="flex flex-col gap-2">
        {lista.map((p) => (
          <li key={p.id} className={`tarjeta flex flex-col gap-2 ${p.activo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold leading-tight">{p.nombre}</p>
                <p className="text-xs text-muted">
                  {p.sku} · {p.categoria}
                  {p.marca && ` · ${p.marca}`}
                  {!p.activo && " · Inactivo"}
                </p>
              </div>
              {u.rol === "DUENO" && (
                <div className="flex shrink-0 gap-2">
                  <Link href={`/productos/${p.id}`} className="btn-secundario flex h-9 items-center text-sm">
                    Editar
                  </Link>
                  <form action={cambiarActivoProducto}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="activo" value={String(!p.activo)} />
                    <button className="btn-secundario h-9 text-sm">{p.activo ? "Ocultar" : "Activar"}</button>
                  </form>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {pres
                .filter((x) => x.productoId === p.id)
                .map((x) => (
                  <span key={x.id} className="rounded-lg bg-slate-100 px-2 py-1">
                    {x.nombre}
                    {x.factor > 1 && ` ×${x.factor}`} · <b>{formatSoles(x.precioVenta)}</b>
                  </span>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
