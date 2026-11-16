import Link from "next/link";
import { formatSoles } from "@/lib/money";
import type { Debtor } from "../queries";

/** GET form: ?ruta= */
export function RouteFilter({ routeId, routes }: { routeId: string; routes: { id: string; name: string }[] }) {
  return (
    <form className="flex gap-2">
      <select name="ruta" defaultValue={routeId} aria-label="Ruta" className="h-12 flex-1 rounded-xl border border-border bg-surface px-3">
        <option value="">Todas las rutas</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button className="btn-secundario h-12">Ver</button>
    </form>
  );
}

export function DebtorList({ debtors }: { debtors: Debtor[] }) {
  if (!debtors.length) return <p className="tarjeta text-muted">Nadie debe.</p>;
  const total = debtors.reduce((s, d) => s + d.balance, 0);
  return (
    <div className="flex flex-col gap-2">
      <ul className="lista">
        {debtors.map((d) => (
          <li key={d.id} className="fila flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Link href={`/clientes/${d.id}/cuenta`} className="font-semibold leading-tight hover:underline">
                {d.name}
              </Link>
              <p className="text-xs text-muted">
                {d.routeName} · hace {d.ageDays} día{d.ageDays === 1 ? "" : "s"}
                {d.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${d.phone}`} className="text-primary underline">
                      {d.phone}
                    </a>
                  </>
                )}
              </p>
              {d.creditLimit !== null && d.balance > d.creditLimit && <p className="text-xs font-semibold text-amber-700">Pasó su límite</p>}
            </div>
            <p className="shrink-0 font-semibold text-red-600">{formatSoles(d.balance)}</p>
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-lg font-bold">
        <span>Por cobrar</span>
        <span>{formatSoles(total)}</span>
      </p>
    </div>
  );
}
