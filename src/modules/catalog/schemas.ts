import { z } from "zod";
import { locationTypeEnum } from "@/server/db/schema";
import { solesSchema } from "@/lib/money-schema";
import { parseKg } from "@/lib/weight";
import { parseSoles } from "@/lib/money";

export const productSchema = z
  .object({
    id: z.uuid().optional(),
    sku: z.string().trim().max(30).toUpperCase(), // empty = generated from the category
    name: z.string().trim().min(2, "Falta el nombre").max(120),
    categoryId: z.uuid("Elige una categoría"),
    brandId: z.uuid().nullable(),
    supplierId: z.uuid().nullable(),
    minStock: z.coerce.number().int().min(0),
    marginPct: z.coerce.number().int().min(0).max(300),
    showInCatalog: z.boolean(),
    packagings: z
      .array(
        z.object({
          id: z.uuid().optional(),
          name: z.string().trim().min(1, "Presentación sin nombre").max(40),
          factor: z.coerce.number().int().min(1, "La cantidad debe ser 1 o más"),
          price: solesSchema,
          barcode: z
            .string()
            .trim()
            .max(30)
            .transform((s) => s || null),
          cost: z.string().transform((s, ctx) => {
            if (!s.trim()) return null;
            const v = parseSoles(s);
            if (v === null) ctx.addIssue({ code: "custom", message: `Costo inválido: "${s}"` });
            return v;
          }),
          weightKg: z.string().transform((s, ctx) => {
            const g = parseKg(s);
            if (g === undefined) ctx.addIssue({ code: "custom", message: `Peso inválido: "${s}" (kg, hasta 3 decimales)` });
            return g ?? null;
          }),
        }),
      )
      .min(1),
  })
  .superRefine((p, ctx) => {
    if (p.packagings[0].factor !== 1) ctx.addIssue({ code: "custom", message: "La primera presentación es la unidad base (cantidad 1)" });
    const names = p.packagings.map((x) => x.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Hay presentaciones con el mismo nombre" });
  });

export const catalogNameSchema = z.object({
  kind: z.enum(["category", "brand", "location"]),
  name: z.string().trim().min(2, "Nombre muy corto").max(40),
  locationType: z.enum(locationTypeEnum.enumValues).optional(),
});

/** Minimal product from the purchase or receipt screens. `cost` is the cost of what is bought (the box if there is one). */
export const quickProductSchema = z.object({
  name: z.string().trim().min(2, "Falta el nombre").max(120),
  categoryId: z.uuid("Elige una categoría"),
  unit: z.string().trim().min(1, "¿Cómo se vende?").max(40),
  packName: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || null),
  packFactor: z.coerce.number().int().min(0).max(100_000),
  cost: z.string().transform((s, ctx) => {
    const v = parseSoles(s);
    if (!v) ctx.addIssue({ code: "custom", message: "Escribe el costo" });
    return v ?? 0;
  }),
  supplierId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
});
