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
    <form className="filtros">
      <input type="date" name="fecha" defaultValue={date} aria-label="Fecha de entrega" className="filtro" />
      <select name="ruta" defaultValue={routeId} className="filtro">
        <option value="">Todas las rutas</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label className="filtro-check">
        <input type="checkbox" name="anulados" value="1" defaultChecked={includeCancelled} /> Ver anulados
      </label>
      <button className="btn-primario h-11 px-5">Ver</button>
    </form>
  );
}
