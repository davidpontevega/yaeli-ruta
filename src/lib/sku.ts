/** "Cuidado del bebé" → "CUI". Sin tildes ni símbolos; mínimo "PRO" si no queda nada. */
export function prefijoSku(categoria: string): string {
  const limpio = categoria
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return limpio.slice(0, 3) || "PRO";
}

/** Siguiente código libre: ("GAL", ["GAL-001","GAL-007","X-9"]) → "GAL-008". */
export function siguienteSku(prefijo: string, existentes: string[]): string {
  const max = existentes.reduce((m, s) => {
    const r = s.match(new RegExp(`^${prefijo}-(\\d+)$`));
    return r ? Math.max(m, Number(r[1])) : m;
  }, 0);
  return `${prefijo}-${String(max + 1).padStart(3, "0")}`;
}
