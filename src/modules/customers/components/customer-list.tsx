import Link from "next/link";
import type { CustomerRow, RouteRow } from "../queries";
import { moveCustomer } from "../actions";

/** GET form: filters live in the URL (?q=&ruta=&inactivos=1). */
export function CustomerFilters({
  q,
  routeId,
  includeInactive,
  routes,
}: {
  q: string;
  routeId: string;
  includeInactive: boolean;
  routes: RouteRow[];
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row">
      <input
        name="q"
        defaultValue={q}
        placeholder="Buscar nombre o teléfono"
        className="h-12 flex-1 rounded-xl border border-border bg-surface px-3"
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
        <input type="checkbox" name="inactivos" value="1" defaultChecked={includeInactive} /> Ver inactivos
      </label>
      <button className="btn-secundario h-12">Buscar</button>
    </form>
  );
}

function MoveButton({ id, dir, disabled }: { id: string; dir: "up" | "down"; disabled: boolean }) {
  return (
    <form action={moveCustomer}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <button disabled={disabled} aria-label={dir === "up" ? "Subir" : "Bajar"} className="btn-secundario h-10 w-10 text-sm disabled:opacity-30">
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

/** `canReorder`: one route shown, unfiltered by text, so the list is that route's full visit order. */
export function CustomerList({ customers, canReorder }: { customers: CustomerRow[]; canReorder: boolean }) {
  if (!customers.length) return <p className="tarjeta text-muted">No hay clientes con ese filtro.</p>;
  const groups = Map.groupBy(customers, (c) => c.routeName);
  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([routeName, list]) => {
        const lastOrder = Math.max(...list.filter((c) => c.active).map((c) => c.routeOrder));
        return (
          <section key={routeName} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase text-muted">{routeName}</h2>
            <ul className="flex flex-col gap-2">
              {list.map((c) => (
                <li key={c.id} className={`tarjeta flex items-center gap-3 ${c.active ? "" : "opacity-50"}`}>
                  {c.active && <span className="w-6 shrink-0 text-center text-sm text-muted">{c.routeOrder}</span>}
                  <div className="min-w-0 flex-1">
                    <Link href={`/clientes/${c.id}`} className="font-semibold leading-tight hover:underline">
                      {c.name}
                    </Link>
                    {!c.active && <span className="ml-2 text-xs text-muted">inactivo</span>}
                    <p className="truncate text-xs text-muted">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-primary underline">
                          {c.phone}
                        </a>
                      )}
                      {c.phone && c.address && " · "}
                      {c.address}
                    </p>
                  </div>
                  {c.active && (
                    <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="btn-secundario flex h-10 shrink-0 items-center text-sm">
                      Pedido
                    </Link>
                  )}
                  {canReorder && c.active && (
                    <div className="flex shrink-0 gap-1">
                      <MoveButton id={c.id} dir="up" disabled={c.routeOrder <= 1} />
                      <MoveButton id={c.id} dir="down" disabled={c.routeOrder >= lastOrder} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
