import { z } from "zod";

const MAX_MONEY = 100_000_000; // S/ 1 millón per line

/** Costs come from the owner (it's his purchase), already in céntimos. */
export const purchaseSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(["ENVIA_PROVEEDOR", "RECOJO"]),
    supplierId: z.uuid().nullable(),
    vehicleId: z.uuid().nullable(),
    lines: z
      .array(
        z.object({
          packagingId: z.uuid(),
          quantity: z.number().int().min(1, "Cantidad mínima 1").max(100_000, "Cantidad demasiado grande"),
          cost: z.number().int().min(0, "Costo inválido").max(MAX_MONEY, "Costo demasiado alto"),
          freight: z.number().int().min(0, "Flete inválido").max(MAX_MONEY, "Flete demasiado alto"),
        }),
      )
      .min(1, "Agrega al menos un producto")
      .max(200, "Máximo 200 líneas")
      .refine((ls) => new Set(ls.map((l) => l.packagingId)).size === ls.length, "Producto repetido"),
  })
  .superRefine((p, ctx) => {
    if (p.type === "ENVIA_PROVEEDOR" && !p.supplierId) ctx.addIssue({ code: "custom", message: "Elige el proveedor" });
  })
  // A supplier sends it: no truck, no freight.
  .transform((p) => (p.type === "ENVIA_PROVEEDOR" ? { ...p, vehicleId: null, lines: p.lines.map((l) => ({ ...l, freight: 0 })) } : p));
export type PurchaseInput = z.infer<typeof purchaseSchema>;
