// Size at the end of a product name: "900 ml", "1.5 L", "x 12", "6 x 34 g".
const SIZE = /\s+((?:\d+(?:[.,]\d+)?\s*x\s*)?(?:\d+(?:[.,]\d+)?\s*(?:ml|lt|l|kg|gr|g|cc|oz|und|un)\.?|x\s*\d+(?:\s*(?:und|un)\.?)?))$/i;

/** "Aceite Cocinero 900 ml" → title "Aceite Cocinero", size "900 ml". No size at the end → size null. */
export function splitLabel(name: string): { title: string; size: string | null } {
  const clean = name.trim();
  const m = clean.match(SIZE);
  const title = m ? clean.slice(0, m.index).trim() : clean;
  return m && title ? { title, size: m[1] } : { title: clean, size: null };
}

export type CatalogRow = { productId: string; photoVersion: number; title: string; size: string | null; side: "left" | "right" };
export type CatalogPage = { title: string; rows: CatalogRow[] };

/**
 * One page per `perPage` products of a group, sorted by name. Later pages of a group get "(2)", "(3)"… Photos alternate sides
 * starting on the right on every page. Empty groups make no page.
 */
export function paginateCatalog(
  groups: { title: string; products: { id: string; name: string; photoVersion: number }[] }[],
  perPage = 5,
): CatalogPage[] {
  return groups.flatMap((g) => {
    const sorted = [...g.products].sort((a, b) => a.name.localeCompare(b.name, "es"));
    const pages: CatalogPage[] = [];
    for (let i = 0; i < sorted.length; i += perPage)
      pages.push({
        title: i ? `${g.title} (${i / perPage + 1})` : g.title,
        rows: sorted.slice(i, i + perPage).map((p, r) => ({
          productId: p.id,
          photoVersion: p.photoVersion,
          ...splitLabel(p.name),
          side: r % 2 ? "left" : "right",
        })),
      });
    return pages;
  });
}
