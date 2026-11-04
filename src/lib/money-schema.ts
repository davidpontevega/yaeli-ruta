import { z } from "zod";
import { parseSoles } from "./money";

/** Form text in soles ("2.50") → integer céntimos. */
export const solesSchema = z.string().transform((s, ctx) => {
  const v = parseSoles(s);
  if (v === null) ctx.addIssue({ code: "custom", message: `Monto inválido: "${s}"` });
  return v ?? 0;
});
