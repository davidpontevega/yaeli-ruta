/** GET form: filters live in the URL (?fecha=&ruta=&anulados=1). */
export function OrderFilters({
  date,
  routeId,
  includeCancelled,
  routes,
}: {
  date: string;
  routeId: string;
  includeCancelled: boolean;
  routes: { id: string; name: string }[];
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row">
      <input
        type="date"
        name="fecha"
        defaultValue={date}
        aria-label="Fecha de entrega"
        className="h-12 rounded-xl border border-border bg-surface px-3"
      />
      <select name="ruta" defaultValue={routeId} className="h-12 rounded-xl border border-border bg-surface px-3">
        <option value="">Todas las rutas</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="anulados" value="1" defaultChecked={includeCancelled} /> Ver anulados
      </label>
      <button className="btn-secundario h-12">Ver</button>
    </form>
  );
}
