/** GET form: ?piso=<location id>; empty = all. */
export function LocationFilter({ locations, value }: { locations: { id: string; name: string }[]; value: string }) {
  return (
    <form className="flex gap-2">
      <select name="piso" defaultValue={value} aria-label="Piso" className="h-12 flex-1 rounded-xl border border-border bg-surface px-3">
        <option value="">Todos los pisos</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button className="btn-secundario h-12">Ver</button>
    </form>
  );
}
