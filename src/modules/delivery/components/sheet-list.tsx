import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ICONS, IconTile } from "@/components/ui/avatar";
import { formatSoles } from "@/lib/money";
import type { SheetRow } from "../queries";

const SHEET_STATUS = {
  PREPARANDO: { label: "Preparando", className: "bg-amber-100 text-amber-800" },
  EN_RUTA: { label: "En ruta", className: "bg-sky-100 text-sky-800" },
  LIQUIDADA: { label: "Liquidada", className: "bg-emerald-100 text-emerald-800" },
} as const;

/** GET date filter (?fecha=) and the sheets of that date. */
export function SheetList({ date, sheets }: { date: string; sheets: SheetRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <form className="filtros">
        <input type="date" name="fecha" defaultValue={date} aria-label="Fecha de reparto" className="filtro" />
        <button className="btn-primario h-11 px-5">Ver</button>
      </form>
      {!sheets.length ? (
        <EmptyState text="No hay hojas de ruta para esa fecha." />
      ) : (
        <ul className="lista">
          {sheets.map((s) => (
            <li key={s.id}>
              <Link href={`/reparto/${s.id}`} className="fila flex items-center gap-3">
                <IconTile d={ICONS.truck} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-tight">
                    {s.routeName} · {s.vehicleName}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="chip bg-slate-100 text-slate-600">#{s.number}</span>
                    <span className="chip bg-slate-100 text-slate-600">
                      {s.orders} pedido{s.orders === 1 ? "" : "s"}
                    </span>
                    <span className={`chip ${SHEET_STATUS[s.status].className}`}>{SHEET_STATUS[s.status].label}</span>
                  </div>
                </div>
                <p className="cifra shrink-0 text-[15px]">{formatSoles(s.total)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
