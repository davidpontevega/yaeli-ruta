/** "2.5" | "2,50" | "S/ 2.50" → 250 céntimos. null si no es un monto válido (máx. 2 decimales, no negativo). */
export function parseSoles(texto: string): number | null {
  const m = texto.trim().replace(/^S\/\s*/i, "").replace(",", ".").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

export function formatSoles(centimos: number): string {
  const signo = centimos < 0 ? "-" : "";
  const abs = Math.abs(centimos);
  return `${signo}S/ ${Math.floor(abs / 100).toLocaleString("es-PE")}.${String(abs % 100).padStart(2, "0")}`;
}

/** For inputs: 250 → "2.50" */
export const toSolesInput = (centimos: number) => (centimos / 100).toFixed(2);
