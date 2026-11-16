import { z } from "zod";
import { parseSoles } from "@/lib/money";
import { PAYMENT_METHOD_IDS } from "@/lib/payment";

export const MAX_AMOUNT = 100_000_000; // S/ 1 millón per movement
const amount = z
  .string()
  .transform((s, ctx) => {
    const v = parseSoles(s);
    if (v === null || v <= 0) ctx.addIssue({ code: "custom", message: `Monto inválido: "${s}"` });
    return v ?? 0;
  })
  .refine((v) => v <= MAX_AMOUNT, "Monto demasiado alto");

export const initialDebtsSchema = z.object({
  date: z.iso.date("Fecha inválida"),
  items: z
    .array(z.object({ customerId: z.uuid("Cliente inválido"), amount }))
    .min(1, "Escribe al menos un monto")
    .max(500),
});

export const paymentSchema = z.object({
  customerId: z.uuid(),
  amount,
  method: z.enum(PAYMENT_METHOD_IDS),
});

/** "+20", "-15.50" → signed céntimos. Sign required so the owner states the direction. */
export const adjustmentSchema = z.object({
  customerId: z.uuid(),
  amount: z
    .string()
    .trim()
    .transform((s, ctx) => {
      const m = s.match(/^([+-])\s*(.+)$/);
      const v = m ? parseSoles(m[2]) : null;
      if (!m || !v || v > MAX_AMOUNT) {
        ctx.addIssue({ code: "custom", message: 'Escribe el monto con signo: "+20" sube la deuda, "-20" la baja' });
        return 0;
      }
      return m[1] === "-" ? -v : v;
    }),
  note: z.string().trim().min(3, "Escribe el motivo").max(200),
});
