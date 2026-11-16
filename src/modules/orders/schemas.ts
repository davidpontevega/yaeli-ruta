import { z } from "zod";
import { solesSchema } from "@/lib/money-schema";
import { PAYMENT_METHOD_IDS } from "@/lib/payment";
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

export const deliverySchema = z.object({
  orderId: z.uuid(),
  lines: z.array(z.object({ packagingId: z.uuid(), delivered: z.coerce.number().int().min(0, "Cantidad inválida").max(MAX_QTY) })).max(80),
  paid: z.union([z.literal(""), solesSchema]).transform((v) => (v === "" ? 0 : v)),
  method: z.enum(PAYMENT_METHOD_IDS),
});
