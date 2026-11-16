"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, like, notInArray } from "drizzle-orm";
import { z } from "zod";
import { audit, db, isForeignKeyViolation, isUniqueViolation } from "@/server/db";
import { brands, categories, locations, packagings, products } from "@/server/db/schema";
import { requireUser } from "@/server/auth";
import type { FormState } from "@/lib/form-state";
import { catalogNameSchema, productSchema } from "./schemas";
import { listPriceReview } from "./queries";
import { nextSku, skuPrefix } from "./sku";
import { baseUnitCost } from "./pricing";

export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser("DUENO");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data")));
  } catch {
    return { error: "Datos inválidos" };
  }
  const input = productSchema.safeParse(raw);
  if (!input.success) return { error: input.error.issues[0].message };
  const p = input.data;
  const values = {
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    brandId: p.brandId,
    supplierId: p.supplierId,
    baseUnit: p.packagings[0].name,
    minStock: p.minStock,
    marginPct: p.marginPct,
  };
  // Typed cost becomes the product's last cost (what /precios prices from); without a cost it stays as is.
  const lastCost = baseUnitCost(p.packagings);

  try {
    await db.transaction(async (tx) => {
      if (!values.sku) {
        const [cat] = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, p.categoryId));
        if (!cat) throw new Error("Categoría no existe");
        const prefix = skuPrefix(cat.name);
        const used = await tx.select({ sku: products.sku }).from(products).where(like(products.sku, `${prefix}-%`));
        values.sku = nextSku(
          prefix,
          used.map((u) => u.sku),
        );
      }
      let productId = p.id;
      const row = lastCost === null ? values : { ...values, lastCost };
      if (productId) {
        await tx.update(products).set(row).where(eq(products.id, productId));
      } else {
        [{ id: productId }] = await tx.insert(products).values(row).returning({ id: products.id });
      }
      const pid = productId!;
      const keep = p.packagings.flatMap((x) => (x.id ? [x.id] : []));
      // ponytail: removed packagings are hard-deleted; once received/sold the FK blocks it (handled below) → switch to deactivate if it annoys.
      await tx.delete(packagings).where(and(eq(packagings.productId, pid), keep.length ? notInArray(packagings.id, keep) : undefined));
      for (const x of p.packagings) {
        const row = { productId: pid, name: x.name, factor: x.factor, salePrice: x.price, barcode: x.barcode, weightGrams: x.weightKg };
        if (x.id) await tx.update(packagings).set(row).where(and(eq(packagings.id, x.id), eq(packagings.productId, pid)));
        else await tx.insert(packagings).values(row);
      }
      await audit(tx, {
        actorId: me.id,
        action: p.id ? "product.update" : "product.create",
        entity: "product",
        entityId: pid,
        details: lastCost === null ? undefined : { lastCost },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Código o código de barras repetido" };
    if (isForeignKeyViolation(e)) return { error: "No puedes quitar una presentación que ya tiene ingresos o pedidos" };
    throw e;
  }
  revalidatePath("/productos");
  redirect("/productos");
}

export async function setProductActive(form: FormData) {
  const me = await requireUser("DUENO");
  const input = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(form));
  const active = input.active === "true";
  await db.transaction(async (tx) => {
    await tx.update(products).set({ active }).where(eq(products.id, input.id));
    await audit(tx, { actorId: me.id, action: active ? "product.activate" : "product.deactivate", entity: "product", entityId: input.id });
  });
  revalidatePath("/productos");
}

/** Adds a category, brand or location (simple name lists). */
export async function addCatalogName(_: FormState, form: FormData): Promise<FormState> {
  await requireUser("DUENO");
  const input = catalogNameSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { kind, name, locationType } = input.data;

  try {
    if (kind === "location") await db.insert(locations).values({ name, type: locationType ?? "ALMACEN" });
    else await db.insert(kind === "category" ? categories : brands).values({ name });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ya existe" };
    throw e;
  }
  revalidatePath("/catalogo");
  return { ok: `${name} agregado` };
}

/** Max load (kg) of a vehicle; empty clears it. */
export async function setLocationCapacity(form: FormData) {
  const me = await requireUser("DUENO");
  const input = z
    .object({ id: z.uuid(), capacityKg: z.union([z.literal(""), z.coerce.number().int().min(1).max(100_000)]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return; // the input enforces the same limits; only a tampered form gets here
  const capacityKg = input.data.capacityKg === "" ? null : input.data.capacityKg;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(locations)
      .set({ capacityKg })
      .where(and(eq(locations.id, input.data.id), eq(locations.type, "VEHICULO")))
      .returning({ id: locations.id });
    if (row) await audit(tx, { actorId: me.id, action: "location.capacity", entity: "location", entityId: row.id, details: { capacityKg } });
  });
  revalidatePath("/catalogo");
}

/** Sets the checked packagings to their suggested price. The suggestion is recomputed here; the client only sends ids. */
export async function applyPrices(form: FormData) {
  const me = await requireUser("DUENO");
  const parsed = z.array(z.uuid()).max(500).safeParse(form.getAll("packagingId"));
  if (!parsed.success) return; // only a tampered form gets here
  const ids = parsed.data;
  const todo = (await listPriceReview()).filter((r) => ids.includes(r.packagingId));
  if (todo.length) {
    await db.transaction(async (tx) => {
      for (const r of todo) {
        await tx.update(packagings).set({ salePrice: r.suggested }).where(eq(packagings.id, r.packagingId));
        await audit(tx, {
          actorId: me.id,
          action: "price.update",
          entity: "packaging",
          entityId: r.packagingId,
          details: { before: r.price, after: r.suggested },
        });
      }
    });
  }
  revalidatePath("/precios");
  revalidatePath("/productos");
  revalidatePath("/");
}
