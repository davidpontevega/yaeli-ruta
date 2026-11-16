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
    <form className="filtros">
      <input name="q" defaultValue={q} placeholder="Buscar nombre, código o escanear" className="filtro" />
      <select name="cat" defaultValue={categoryId} className="filtro">
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select name="proveedor" defaultValue={supplierId} aria-label="Proveedor" className="filtro">
        <option value="">Todos los proveedores</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value="none">Sin proveedor</option>
      </select>
      {onlyMissing && <input type="hidden" name="falta" value="1" />}
      {canSeeInactive && (
        <label className="filtro-check">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={includeInactive} /> Inactivos
        </label>
      )}
      <button className="btn-primario h-11 px-5">Buscar</button>
    </form>
  );
}
