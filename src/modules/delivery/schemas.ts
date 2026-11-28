import { z } from "zod";
import { solesSchema } from "@/lib/money-schema";
import { PAYMENT_METHOD_IDS } from "@/lib/payment";
import { deliverySchema } from "@/modules/orders";

export const createSheetSchema = z.object({
  routeId: z.uuid("Elige una ruta"),
  date: z.iso.date("Fecha inválida"),
  vehicleId: z.uuid("Elige un vehículo"),
  driverId: z.uuid("Repartidor inválido").optional(), // empty = the owner delivers
});

export const sheetIdSchema = z.object({ sheetId: z.uuid("Hoja inválida") });

export const sheetDriverSchema = sheetIdSchema.extend({ driverId: z.uuid("Repartidor inválido").optional() });

export const sheetOrderSchema = sheetIdSchema.extend({ orderId: z.uuid("Pedido inválido") });

export const settleSchema = sheetIdSchema.extend({ declared: solesSchema });

// Delivery saved on the phone without signal (spec 025). `paid` already in céntimos.
export const offlineOpSchema = z.object({
  id: z.uuid(),
  sheetId: z.uuid(),
  orderId: z.uuid(),
  lines: deliverySchema.shape.lines,
  paid: z.number().int().min(0),
  method: z.enum(PAYMENT_METHOD_IDS),
});
export type OfflineOpInput = z.infer<typeof offlineOpSchema>;

export const syncSchema = z.object({ ops: z.array(offlineOpSchema).min(1).max(50) });
