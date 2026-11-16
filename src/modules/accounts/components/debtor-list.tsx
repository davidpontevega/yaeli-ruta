import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { Avatar, Glyph, ICONS } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/stat";
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

const AGES = [
  { key: "old", title: "Más de 60 días", hint: "Cobra ya", min: 61, head: "bg-red-50", chip: "bg-red-100 text-red-800", figure: "text-red-700" },
  {
    key: "mid",
    title: "De 31 a 60 días",
    hint: "Recuérdale",
    min: 31,
    head: "bg-amber-50",
    chip: "bg-amber-100 text-amber-800",
    figure: "text-amber-700",
  },
  { key: "new", title: "Hasta 30 días", hint: "Al día con su ruta", min: 0, head: "bg-slate-50/70", chip: "bg-slate-100 text-slate-700", figure: "" },
] as const;
const ageGroup = (days: number) => AGES.find((a) => days >= a.min)!;

/** Summary, then debtors grouped by how old their debt is (oldest first), with call and collect actions. */
export function DebtorList({ debtors }: { debtors: Debtor[] }) {
  if (!debtors.length) return <EmptyState text="Nadie debe." tone="bg-emerald-50 text-emerald-600" />;
  const total = debtors.reduce((s, d) => s + d.balance, 0);
  const overLimit = debtors.filter((d) => d.creditLimit !== null && d.balance > d.creditLimit).length;
  const oldest = Math.max(...debtors.map((d) => d.ageDays));
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Por cobrar" value={formatSoles(total)} tone="text-red-700" />
        <Stat label="Clientes que deben" value={debtors.length} />
        <Stat label="Pasaron su límite" value={overLimit} tone={overLimit ? "text-amber-700" : ""} />
        <Stat label="Deuda más antigua" value={`${oldest} día${oldest === 1 ? "" : "s"}`} tone={oldest > 60 ? "text-red-700" : ""} />
      </div>
      {AGES.map((g) => {
        const list = debtors.filter((d) => ageGroup(d.ageDays).key === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="lista">
            <header className={`flex items-center justify-between gap-2 px-4 py-3 ${g.head}`}>
              <h2 className="flex items-center gap-2 font-bold">
                {g.title}
                <span className={`chip ${g.chip}`}>{list.length}</span>
                <span className="hidden text-xs font-normal text-muted sm:inline">{g.hint}</span>
              </h2>
              <span className={`cifra ${g.figure}`}>{formatSoles(list.reduce((s, d) => s + d.balance, 0))}</span>
            </header>
            <ul className="celdas">
              {list.map((d) => (
                <li key={d.id} className="fila flex items-center gap-3">
                  <Avatar name={d.name} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/clientes/${d.id}/cuenta`} className="block truncate font-semibold leading-tight hover:text-primary">
                      {d.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="chip bg-slate-100 text-slate-700">{d.routeName}</span>
                      <span className={`chip ${g.chip}`}>
                        hace {d.ageDays} día{d.ageDays === 1 ? "" : "s"}
                      </span>
                      {d.creditLimit !== null && d.balance > d.creditLimit && (
                        <span className="chip bg-amber-100 text-amber-800">pasó su límite</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="cifra text-lg text-red-600">{formatSoles(d.balance)}</span>
                    <span className="flex gap-1.5">
                      {d.phone && (
                        <a
                          href={`tel:${d.phone}`}
                          aria-label={`Llamar a ${d.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-600 hover:bg-slate-100"
                        >
                          <Glyph d={ICONS.phone} />
                        </a>
                      )}
                      <Link href={`/clientes/${d.id}/cuenta`} className="btn-suave h-8 px-3 text-xs">
                        Cobrar
                      </Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
