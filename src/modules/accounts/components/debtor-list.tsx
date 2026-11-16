import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { Avatar } from "@/components/ui/avatar";
import type { Debtor } from "../queries";

/** GET form: ?ruta= */
export function RouteFilter({ routeId, routes }: { routeId: string; routes: { id: string; name: string }[] }) {
  return (
    <form className="filtros">
      <select name="ruta" defaultValue={routeId} aria-label="Ruta" className="filtro">
        <option value="">Todas las rutas</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button className="btn-primario h-11 px-5">Ver</button>
    </form>
  );
}

export function DebtorList({ debtors }: { debtors: Debtor[] }) {
  if (!debtors.length) return <EmptyState text="Nadie debe." tone="bg-emerald-50 text-emerald-600" />;
  const total = debtors.reduce((s, d) => s + d.balance, 0);
  return (
    <div className="flex flex-col gap-2">
      <ul className="lista">
        {debtors.map((d) => (
          <li key={d.id} className="fila flex items-center gap-3">
            <Avatar name={d.name} />
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
              {d.creditLimit !== null && d.balance > d.creditLimit && <span className="chip mt-1 bg-amber-100 text-amber-800">Pasó su límite</span>}
            </div>
            <p className="cifra shrink-0 text-lg text-red-600">{formatSoles(d.balance)}</p>
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
