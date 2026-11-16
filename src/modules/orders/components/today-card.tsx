import Link from "next/link";
import { formatSoles } from "@/lib/money";
import type { TodaySummary } from "../queries";

/** "Entregas de hoy": progress of today's orders. */
export function TodayCard({ today }: { today: TodaySummary }) {
  const pct = today.count ? Math.round((today.delivered * 100) / today.count) : 0;
  return (
    <section className="tarjeta flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Entregas de hoy</h2>
        <Link href="/pedidos" className="text-sm font-semibold text-primary">
          Ver todas
        </Link>
      </div>
      {today.count ? (
        <>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="cifra text-[28px]">
              {today.delivered} de {today.count}
            </span>
            <span className="text-sm text-muted">entregados · {formatSoles(today.total)}</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {today.routes.map((r) => (
              <span key={r.name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                {r.name} · {r.n}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No hay pedidos para entregar hoy.</p>
      )}
    </section>
  );
}
