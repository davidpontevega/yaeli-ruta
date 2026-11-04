import { z } from "zod";
import { receiptTypeEnum } from "@/server/db/schema";
import { solesSchema } from "@/lib/money-schema";

const optionalText = z
  .string()
  .trim()
  .max(80)
  .transform((s) => s || null);

export const receiptSchema = z.object({
  type: z.enum(receiptTypeEnum.enumValues),
  supplier: optionalText,
  document: optionalText,
  items: z
    .array(
      z.object({
        packagingId: z.uuid("Elige la presentación"),
        quantity: z.coerce.number().int().min(1, "La cantidad debe ser 1 o más").max(100_000, "Cantidad demasiado grande"),
        unitCost: solesSchema,
        expiresOn: z.union([z.literal(""), z.iso.date("Fecha de vencimiento inválida")]).transform((s) => s || null),
        locationId: z.uuid("Elige el piso"),
      }),
    )
    .min(1, "Agrega al menos un producto"),
});
