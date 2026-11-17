import { z } from "zod";
import { solesSchema } from "@/lib/money-schema";

const optionalId = z.union([z.literal(""), z.uuid()]).transform((v) => v || undefined);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null);

export const routeSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Escribe el nombre de la ruta").max(60),
  days: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Marca al menos un día de visita"),
});

export const customerSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Escribe el nombre del cliente").max(80),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 9, "El teléfono debe tener 9 dígitos")
    .transform((v) => v || null),
  routeId: z.uuid("Elige la ruta"),
  address: optionalText(150),
  reference: optionalText(150),
  creditLimit: z.union([z.literal(""), solesSchema]).transform((v) => (v === "" ? null : v)),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** S/ 1 000 000 per packaging: keeps quantity × price of an order line far under the order total cap. */
// Same ceiling as an order line; keep in sync with MAX_TOTAL in orders/actions.ts (not imported: orders already depends on customers).
const MAX_PRICE = 100_000_000;

export const specialPriceSchema = z.object({
  customerId: z.uuid(),
  packagingId: z.uuid("Elige la presentación"),
  price: solesSchema.refine((v) => v > 0 && v <= MAX_PRICE, "El precio debe ser mayor que 0 y hasta S/ 1 000 000"),
});
