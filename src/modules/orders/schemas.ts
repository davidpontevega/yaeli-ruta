import { z } from "zod";
import { MAX_QTY } from "./order-math";

export const orderSchema = z.object({
  id: z.uuid().optional(),
  customerId: z.uuid(),
  deliveryOn: z.iso.date("Fecha de entrega inválida"),
  lines: z
    .array(z.object({ packagingId: z.uuid(), quantity: z.number().int().min(1, "Cantidad mínima 1").max(MAX_QTY) }))
    .min(1, "Agrega al menos un producto")
    .max(80, "Máximo 80 líneas")
    .refine((ls) => new Set(ls.map((l) => l.packagingId)).size === ls.length, "Producto repetido"),
});
export type OrderInput = z.infer<typeof orderSchema>;
