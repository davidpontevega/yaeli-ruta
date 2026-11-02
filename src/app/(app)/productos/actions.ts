"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, like, notInArray } from "drizzle-orm";
import { z } from "zod";
import { auditar, db, esDuplicado } from "@/server/db";
import { categorias, marcas, presentaciones, productos, tipoUbicacionEnum, ubicaciones } from "@/server/db/schema";
import { requerirUsuario } from "@/server/auth";
import { parseSoles } from "@/lib/dinero";
import { prefijoSku, siguienteSku } from "@/lib/sku";

export type Estado = { error?: string; ok?: string } | undefined;

const soles = z.string().transform((s, ctx) => {
  const v = parseSoles(s);
  if (v === null) ctx.addIssue({ code: "custom", message: `Precio inválido: "${s}"` });
  return v ?? 0;
});

const productoSchema = z
  .object({
    id: z.uuid().optional(),
    sku: z.string().trim().max(30).toUpperCase(), // vacío = se genera desde la categoría
    nombre: z.string().trim().min(2, "Falta el nombre").max(120),
    categoriaId: z.uuid("Elige una categoría"),
    marcaId: z.uuid().nullable(),
    stockMinimo: z.coerce.number().int().min(0),
    margenPct: z.coerce.number().int().min(0).max(300),
    presentaciones: z
      .array(
        z.object({
          id: z.uuid().optional(),
          nombre: z.string().trim().min(1, "Presentación sin nombre").max(40),
          factor: z.coerce.number().int().min(1, "La cantidad debe ser 1 o más"),
          precio: soles,
          codigoBarras: z.string().trim().max(30).transform((s) => s || null),
        }),
      )
      .min(1),
  })
  .superRefine((p, ctx) => {
    if (p.presentaciones[0].factor !== 1) ctx.addIssue({ code: "custom", message: "La primera presentación es la unidad base (cantidad 1)" });
    const nombres = p.presentaciones.map((x) => x.nombre.toLowerCase());
    if (new Set(nombres).size !== nombres.length) ctx.addIssue({ code: "custom", message: "Hay presentaciones con el mismo nombre" });
  });

export async function guardarProducto(_: Estado, form: FormData): Promise<Estado> {
  const yo = await requerirUsuario("DUENO");
  let crudo: unknown;
  try {
    crudo = JSON.parse(String(form.get("datos")));
  } catch {
    return { error: "Datos inválidos" };
  }
  const d = productoSchema.safeParse(crudo);
  if (!d.success) return { error: d.error.issues[0].message };
  const p = d.data;
  const valores = {
    sku: p.sku,
    nombre: p.nombre,
    categoriaId: p.categoriaId,
    marcaId: p.marcaId,
    unidadBase: p.presentaciones[0].nombre,
    stockMinimo: p.stockMinimo,
    margenPct: p.margenPct,
  };

  try {
    await db.transaction(async (tx) => {
      if (!valores.sku) {
        const [cat] = await tx.select({ nombre: categorias.nombre }).from(categorias).where(eq(categorias.id, p.categoriaId));
        if (!cat) throw new Error("Categoría no existe");
        const prefijo = prefijoSku(cat.nombre);
        const usados = await tx.select({ sku: productos.sku }).from(productos).where(like(productos.sku, `${prefijo}-%`));
        valores.sku = siguienteSku(prefijo, usados.map((u) => u.sku));
      }
      let productoId = p.id;
      if (productoId) {
        await tx.update(productos).set(valores).where(eq(productos.id, productoId));
      } else {
        [{ id: productoId }] = await tx.insert(productos).values(valores).returning({ id: productos.id });
      }
      const pid = productoId!;
      const conservar = p.presentaciones.flatMap((x) => (x.id ? [x.id] : []));
      // ponytail: borrado físico de presentaciones quitadas; cuando haya pedidos que las referencien, la FK lo impedirá → pasar a desactivar.
      await tx
        .delete(presentaciones)
        .where(and(eq(presentaciones.productoId, pid), conservar.length ? notInArray(presentaciones.id, conservar) : undefined));
      for (const x of p.presentaciones) {
        const fila = { productoId: pid, nombre: x.nombre, factor: x.factor, precioVenta: x.precio, codigoBarras: x.codigoBarras };
        if (x.id) await tx.update(presentaciones).set(fila).where(and(eq(presentaciones.id, x.id), eq(presentaciones.productoId, pid)));
        else await tx.insert(presentaciones).values(fila);
      }
      await auditar(tx, { actorId: yo.id, accion: p.id ? "producto.editar" : "producto.crear", entidad: "producto", entidadId: pid });
    });
  } catch (e) {
    if (esDuplicado(e)) return { error: "Código o código de barras repetido" };
    throw e;
  }
  revalidatePath("/productos");
  redirect("/productos");
}

export async function cambiarActivoProducto(form: FormData) {
  const yo = await requerirUsuario("DUENO");
  const d = z.object({ id: z.uuid(), activo: z.enum(["true", "false"]) }).parse(Object.fromEntries(form));
  await db.transaction(async (tx) => {
    await tx.update(productos).set({ activo: d.activo === "true" }).where(eq(productos.id, d.id));
    await auditar(tx, { actorId: yo.id, accion: d.activo === "true" ? "producto.activar" : "producto.desactivar", entidad: "producto", entidadId: d.id });
  });
  revalidatePath("/productos");
}

// ── Categorías, marcas y ubicaciones: listas simples ─────────────────────────

const tablas = { categoria: categorias, marca: marcas } as const;

export async function agregarNombre(_: Estado, form: FormData): Promise<Estado> {
  await requerirUsuario("DUENO");
  const d = z
    .object({
      tipo: z.enum(["categoria", "marca", "ubicacion"]),
      nombre: z.string().trim().min(2, "Nombre muy corto").max(40),
      tipoUbicacion: z.enum(tipoUbicacionEnum.enumValues).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };

  try {
    if (d.data.tipo === "ubicacion") {
      await db.insert(ubicaciones).values({ nombre: d.data.nombre, tipo: d.data.tipoUbicacion ?? "ALMACEN" });
    } else {
      await db.insert(tablas[d.data.tipo]).values({ nombre: d.data.nombre });
    }
  } catch (e) {
    if (esDuplicado(e)) return { error: "Ya existe" };
    throw e;
  }
  revalidatePath("/catalogo");
  return { ok: `${d.data.nombre} agregado` };
}
