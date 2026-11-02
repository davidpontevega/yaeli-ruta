import { z } from "zod";
import { locationTypeEnum } from "@/server/db/schema";
import { parseSoles } from "@/lib/money";

const soles = z.string().transform((s, ctx) => {
  const v = parseSoles(s);
  if (v === null) ctx.addIssue({ code: "custom", message: `Precio inválido: "${s}"` });
  return v ?? 0;
});

export const productSchema = z
  .object({
    id: z.uuid().optional(),
    sku: z.string().trim().max(30).toUpperCase(), // empty = generated from the category
    name: z.string().trim().min(2, "Falta el nombre").max(120),
    categoryId: z.uuid("Elige una categoría"),
    brandId: z.uuid().nullable(),
    minStock: z.coerce.number().int().min(0),
    marginPct: z.coerce.number().int().min(0).max(300),
    packagings: z
      .array(
        z.object({
          id: z.uuid().optional(),
          name: z.string().trim().min(1, "Presentación sin nombre").max(40),
          factor: z.coerce.number().int().min(1, "La cantidad debe ser 1 o más"),
          price: soles,
          barcode: z
            .string()
            .trim()
            .max(30)
            .transform((s) => s || null),
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
