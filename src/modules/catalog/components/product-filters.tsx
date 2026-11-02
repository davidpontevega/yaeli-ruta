import type { CatalogOption } from "../queries";

/** GET form: filters live in the URL (?q=&cat=&inactivos=1). */
export function ProductFilters({
  q,
  categoryId,
  includeInactive,
  categories,
  canSeeInactive,
}: {
  q: string;
  categoryId: string;
  includeInactive: boolean;
  categories: CatalogOption[];
  canSeeInactive: boolean;
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row">
      <input name="q" defaultValue={q} placeholder="Buscar nombre, código o escanear" className="h-12 flex-1 rounded-xl border border-border bg-surface px-3" />
      <select name="cat" defaultValue={categoryId} className="h-12 rounded-xl border border-border bg-surface px-3">
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {canSeeInactive && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={includeInactive} /> Inactivos
        </label>
      )}
      <button className="btn-secundario h-12">Buscar</button>
    </form>
  );
}
