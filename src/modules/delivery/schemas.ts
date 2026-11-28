import { z } from "zod";
import { solesSchema } from "@/lib/money-schema";

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
