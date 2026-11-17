import Link from "next/link";
import { ICONS, IconTile } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { formatSoles } from "@/lib/money";
import { formatKg } from "@/lib/weight";
import type { PurchaseRow } from "../queries";

const SECTIONS = [
  { status: "BORRADOR", title: "Por comprar", chip: "bg-amber-100 text-amber-800", head: "bg-amber-50/70" },
  { status: "RECIBIDA", title: "Recibidas", chip: "bg-emerald-100 text-emerald-800", head: "bg-slate-50/70" },
  { status: "ANULADA", title: "Anuladas", chip: "bg-slate-200 text-slate-600", head: "bg-slate-50/70" },
] as const;
const formatDay = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short" });

/** Summary, then the purchase lists grouped by status (drafts first: what is still to buy). */
export function PurchaseList({ purchases }: { purchases: PurchaseRow[] }) {
  const drafts = purchases.filter((p) => p.status === "BORRADOR");
  const received = purchases.filter((p) => p.status === "RECIBIDA");
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Por comprar" value={drafts.length} tone={drafts.length ? "text-amber-700" : ""} hint="listas en borrador" />
        <Stat label="Monto por comprar" value={formatSoles(drafts.reduce((s, p) => s + p.total, 0))} tone="text-primary" />
        <Stat label="Peso por recoger" value={formatKg(drafts.filter((p) => p.type === "RECOJO").reduce((s, p) => s + p.weight, 0))} />
        <Stat label="Recibidas" value={received.length} tone={received.length ? "text-emerald-700" : ""} hint="de las últimas 100" />
      </div>

      {!purchases.length ? (
        <EmptyState text="Aún no hay listas de pedido. Arma la primera con «+ Nueva lista»." />
      ) : (
        SECTIONS.map((sec) => {
          const list = purchases.filter((p) => p.status === sec.status);
          if (!list.length) return null;
          return (
            <section key={sec.status} className="lista">
              <header className={`flex items-center justify-between gap-2 px-4 py-3 ${sec.head}`}>
                <h2 className="flex items-center gap-2 font-bold">
                  {sec.title}
                  <span className={`chip ${sec.chip}`}>{list.length}</span>
                </h2>
                <span className="cifra">{formatSoles(list.reduce((s, p) => s + p.total, 0))}</span>
              </header>
              <ul className="celdas">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link href={`/compras/${p.id}`} className={`fila flex items-center gap-3 ${p.status === "ANULADA" ? "opacity-60" : ""}`}>
                      <IconTile
                        d={p.type === "RECOJO" ? ICONS.truck : ICONS.box}
                        tone={p.type === "RECOJO" ? "bg-sky-50 text-sky-700" : "bg-teal-50 text-teal-700"}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight">
                          {p.type === "RECOJO" ? (p.vehicleName ?? "Recojo") : (p.supplierName ?? "Proveedor")}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="chip bg-slate-100 text-slate-600">#{p.number}</span>
                          <span className="chip bg-slate-100 text-slate-600">{formatDay(new Date(p.createdAt))}</span>
                          <span className={`chip ${p.type === "RECOJO" ? "bg-sky-50 text-sky-800" : "bg-teal-50 text-teal-800"}`}>
                            {p.type === "RECOJO" ? "Recojo" : "Envía proveedor"}
                          </span>
                          <span className="chip bg-slate-100 text-slate-600">
                            {p.lines} producto{p.lines === 1 ? "" : "s"}
                          </span>
                          {p.weight > 0 && <span className="chip bg-slate-100 text-slate-600">{formatKg(p.weight)}</span>}
                        </div>
                      </div>
                      <p className="cifra shrink-0 text-[15px]">{formatSoles(p.total)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
