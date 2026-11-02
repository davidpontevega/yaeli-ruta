import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { presentaciones, productos } from "@/server/db/schema";
import { requerirUsuario } from "@/server/auth";
import { solesInput } from "@/lib/dinero";
import { ProductoForm } from "../producto-form";
import { opcionesCatalogo } from "../opciones";

export default async function EditarProductoPage({ params }: PageProps<"/productos/[id]">) {
  await requerirUsuario("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [[p], pres, [categorias, marcas]] = await Promise.all([
    db.select().from(productos).where(eq(productos.id, id.data)).limit(1),
    db.select().from(presentaciones).where(eq(presentaciones.productoId, id.data)).orderBy(asc(presentaciones.factor)),
    opcionesCatalogo(),
  ]);
  if (!p) notFound();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <ProductoForm
        categorias={categorias}
        marcas={marcas}
        inicial={{
          id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          categoriaId: p.categoriaId,
          marcaId: p.marcaId ?? "",
          stockMinimo: p.stockMinimo,
          margenPct: p.margenPct,
          presentaciones: pres.map((x) => ({
            id: x.id,
            nombre: x.nombre,
            factor: String(x.factor),
            precio: solesInput(x.precioVenta),
            codigoBarras: x.codigoBarras ?? "",
          })),
        }}
      />
    </section>
  );
}
