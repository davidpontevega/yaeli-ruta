import Link from "next/link";
import { Glyph, ICONS, IconTile } from "@/components/ui/avatar";
import type { RouteRow } from "../queries";
import { DAY_NAMES } from "../route-days";
import { RouteForm } from "./route-form";

export function RouteList({ routes }: { routes: RouteRow[] }) {
  if (!routes.length)
    return (
      <div className="tarjeta flex flex-col items-center gap-2 py-10 text-center">
        <IconTile d={ICONS.pin} />
        <p className="font-semibold">Aún no hay rutas</p>
        <p className="text-sm text-muted">Crea la primera con el formulario.</p>
      </div>
    );
  return (
    <ul className="lista">
      {routes.map((r) => (
        <li key={r.id} className="fila flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconTile d={ICONS.pin} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="font-semibold leading-tight">{r.name}</p>
              <div className="flex flex-wrap gap-1">
                {[...r.days]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <span key={d} className="chip bg-slate-100 text-slate-700">
                      {DAY_NAMES[d - 1]}
                    </span>
                  ))}
              </div>
            </div>
            <Link href={`/clientes?ruta=${r.id}`} className="btn-suave h-9 shrink-0 px-3 text-sm">
              <Glyph d={ICONS.users} />
              {r.customers}
              <span className="hidden sm:inline">cliente{r.customers === 1 ? "" : "s"}</span>
            </Link>
          </div>
          <details className="group">
            <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted hover:bg-slate-100 hover:text-foreground">
              <Glyph d={ICONS.pencil} />
              <span className="group-open:hidden">Editar</span>
              <span className="hidden group-open:inline">Cerrar</span>
            </summary>
            <div className="mt-2 rounded-xl border border-border bg-slate-50 p-3">
              <RouteForm initial={{ id: r.id, name: r.name, days: r.days }} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
