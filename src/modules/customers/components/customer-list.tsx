import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { Avatar, Glyph, ICONS, IconTile } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/stat";
import { DAY_NAMES } from "../route-days";
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
    <form className="filtros">
      <input name="q" defaultValue={q} placeholder="Buscar nombre o teléfono" className="filtro" />
      <select name="ruta" defaultValue={routeId} className="filtro">
        <option value="">Todas las rutas</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label className="filtro-check">
        <input type="checkbox" name="inactivos" value="1" defaultChecked={includeInactive} /> Ver inactivos
      </label>
      <button className="btn-primario h-11 px-5">Buscar</button>
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
export function CustomerList({
  customers,
  canReorder,
  balances,
  routes,
}: {
  customers: CustomerRow[];
  canReorder: boolean;
  balances: Record<string, number>; // céntimos owed per customer
  routes: RouteRow[];
}) {
  const owing = customers.filter((c) => (balances[c.id] ?? 0) > 0);
  const daysOf = new Map(routes.map((r) => [r.name, r.days]));
  const groups = Map.groupBy(customers, (c) => c.routeName);
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Clientes" value={customers.filter((c) => c.active).length} />
        <Stat href="/rutas" label="Rutas" value={groups.size} />
        <Stat href="/deudores" label="Deben" value={owing.length} tone={owing.length ? "text-red-700" : ""} />
        <Stat
          href="/deudores"
          label="Por cobrar"
          value={formatSoles(owing.reduce((s, c) => s + balances[c.id], 0))}
          tone={owing.length ? "text-red-700" : ""}
        />
      </div>
      {!customers.length ? (
        <EmptyState text="No hay clientes con ese filtro." />
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups].map(([routeName, list]) => {
            const lastOrder = Math.max(...list.filter((c) => c.active).map((c) => c.routeOrder));
            return (
              <section key={routeName} className="lista">
                <header className="flex items-center gap-3 bg-slate-50/70 px-4 py-3">
                  <IconTile d={ICONS.pin} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold leading-tight">{routeName}</h2>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[...(daysOf.get(routeName) ?? [])]
                        .sort((a, b) => a - b)
                        .map((d) => (
                          <span key={d} className="chip bg-teal-50 text-teal-800">
                            {DAY_NAMES[d - 1]}
                          </span>
                        ))}
                      <span className="chip bg-slate-100 text-slate-700">
                        {list.length} cliente{list.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </header>
                <ul className="celdas">
                  {list.map((c) => (
                    <li key={c.id} className={`fila flex items-center gap-3 ${c.active ? "" : "opacity-50"}`}>
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/clientes/${c.id}`} className="font-semibold leading-tight hover:underline">
                          {c.name}
                        </Link>
                        {!c.active && <span className="chip ml-2 bg-slate-100 text-muted">inactivo</span>}
                        <p className="truncate text-xs text-muted">
                          {c.active && <span className="mr-1 font-semibold text-slate-500">#{c.routeOrder}</span>}
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="text-primary underline">
                              {c.phone}
                            </a>
                          )}
                          {c.phone && c.address && " · "}
                          {c.address}
                        </p>
                      </div>
                      <Link
                        href={`/clientes/${c.id}/cuenta`}
                        className={`chip shrink-0 ${(balances[c.id] ?? 0) > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {(balances[c.id] ?? 0) > 0 ? formatSoles(balances[c.id]) : "Al día"}
                      </Link>
                      {c.active && (
                        <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="btn-suave h-9 shrink-0 px-3 text-sm">
                          <Glyph d={ICONS.plus} />
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
      )}
    </>
  );
}
