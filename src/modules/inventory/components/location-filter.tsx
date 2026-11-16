/** GET form: ?piso=<location id>; empty = all. */
export function LocationFilter({ locations, value }: { locations: { id: string; name: string }[]; value: string }) {
  return (
    <form className="filtros">
      <select name="piso" defaultValue={value} aria-label="Piso" className="filtro">
        <option value="">Todos los pisos</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button className="btn-primario h-11 px-5">Ver</button>
    </form>
  );
}
