/** "Cuidado del bebé" → "CUI". No accents or symbols; "PRO" if nothing is left. */
export function skuPrefix(category: string): string {
  const clean = category
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return clean.slice(0, 3) || "PRO";
}

/** Next free code: ("GAL", ["GAL-001","GAL-007","X-9"]) → "GAL-008". */
export function nextSku(prefix: string, existing: string[]): string {
  const max = existing.reduce((m, s) => {
    const r = s.match(new RegExp(`^${prefix}-(\\d+)$`));
    return r ? Math.max(m, Number(r[1])) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
