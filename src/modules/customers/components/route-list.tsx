import Link from "next/link";
import type { RouteRow } from "../queries";
import { formatDays } from "../route-days";
import { RouteForm } from "./route-form";

export function RouteList({ routes }: { routes: RouteRow[] }) {
  if (!routes.length) return <p className="tarjeta text-muted">Aún no hay rutas. Crea la primera arriba.</p>;
  return (
    <ul className="lista">
      {routes.map((r) => (
        <li key={r.id} className="fila flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{r.name}</p>
              <p className="text-xs text-muted">{formatDays(r.days)}</p>
            </div>
            <Link href={`/clientes?ruta=${r.id}`} className="shrink-0 text-sm text-primary underline">
              {r.customers} cliente{r.customers === 1 ? "" : "s"}
            </Link>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-primary">Editar</summary>
            <div className="pt-2">
              <RouteForm initial={{ id: r.id, name: r.name, days: r.days }} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
