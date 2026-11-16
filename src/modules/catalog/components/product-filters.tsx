import type { CatalogOption } from "../queries";

/** GET form: filters live in the URL (?q=&cat=&proveedor=&inactivos=1&falta=1). `onlyMissing` undefined hides that checkbox. */
export function ProductFilters({
  q,
  categoryId,
  supplierId,
  includeInactive,
  onlyMissing,
  categories,
  suppliers,
  canSeeInactive,
}: {
  q: string;
  categoryId: string;
  supplierId: string;
  includeInactive: boolean;
  onlyMissing?: boolean;
  categories: CatalogOption[];
  suppliers: CatalogOption[];
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
      <select name="proveedor" defaultValue={supplierId} aria-label="Proveedor" className="h-12 rounded-xl border border-border bg-surface px-3">
        <option value="">Todos los proveedores</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value="none">Sin proveedor</option>
      </select>
      {onlyMissing !== undefined && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="falta" value="1" defaultChecked={onlyMissing} /> Solo lo que falta
        </label>
      )}
      {canSeeInactive && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={includeInactive} /> Inactivos
        </label>
      )}
      <button className="btn-secundario h-12">Buscar</button>
    </form>
  );
}
