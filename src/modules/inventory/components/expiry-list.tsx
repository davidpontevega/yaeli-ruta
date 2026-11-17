import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSoles } from "@/lib/money";
import type { ExpiryBucket } from "../expiry";
import { formatQty } from "../format";
import type { ExpiringLot } from "../queries";

const GROUPS: { bucket: ExpiryBucket; title: string; hint: string; head: string; tile: string; chip: string; figure: string }[] = [
  {
    bucket: "expired",
    title: "Vencidos",
    hint: "Sácalos del almacén",
    head: "bg-red-50",
    tile: "bg-red-600 text-white",
    chip: "bg-red-100 text-red-800",
    figure: "text-red-700",
  },
  {
    bucket: "30",
    title: "En 30 días",
    hint: "Véndelos primero",
    head: "bg-amber-50",
    tile: "bg-amber-500 text-white",
    chip: "bg-amber-100 text-amber-800",
    figure: "text-amber-700",
  },
  {
    bucket: "60",
    title: "En 31–60 días",
    hint: "Ofrécelos en ruta",
    head: "bg-yellow-50",
    tile: "bg-yellow-100 text-yellow-800",
    chip: "bg-yellow-50 text-yellow-800",
    figure: "text-yellow-700",
  },
  {
    bucket: "90",
    title: "En 61–90 días",
    hint: "Tenlos a la vista",
    head: "bg-slate-50",
    tile: "bg-slate-200 text-slate-700",
    chip: "bg-slate-100 text-slate-700",
    figure: "text-slate-700",
  },
];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const when = (days: number) =>
  days < 0 ? `venció hace ${-days} día${days === -1 ? "" : "s"}` : days === 0 ? "vence hoy" : `en ${days} día${days === 1 ? "" : "s"}`;

/** Summary of the four windows, then each window's lots with a calendar tile (day + month) colored by urgency. */
export function ExpiryList({ lots }: { lots: ExpiringLot[] }) {
  if (!lots.length) return <EmptyState text="Nada por vencer en 90 días." tone="bg-emerald-50 text-emerald-600" />;
  const owner = lots.some((l) => l.value !== null);
  const sum = (ls: ExpiringLot[]) => ls.reduce((s, l) => s + (l.value ?? 0), 0);
  const urgent = lots.filter((l) => l.bucket === "expired" || l.bucket === "30");
  return (
    <>
      {urgent.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-lg font-bold text-white">
            !
          </span>
          <p className="min-w-0 flex-1 text-sm text-red-900">
            <b>
              {urgent.length} lote{urgent.length === 1 ? "" : "s"}
            </b>{" "}
            vencido{urgent.length === 1 ? "" : "s"} o por vencer en 30 días. Véndelos primero o sácalos del almacén.
          </p>
          {owner && (
            <span className="shrink-0 text-right">
              <span className="block text-[11px] text-red-800">En riesgo</span>
              <span className="cifra text-lg text-red-700">{formatSoles(sum(urgent))}</span>
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {GROUPS.map((g) => {
          const n = lots.filter((l) => l.bucket === g.bucket).length;
          return (
            <a key={g.bucket} href={`#${g.bucket}`} className="tarjeta flex flex-col gap-0.5 px-4 py-3 transition hover:border-slate-300">
              <span className="text-xs font-medium text-muted">{g.title}</span>
              <span className={`cifra text-2xl ${n ? g.figure : "text-slate-400"}`}>{n}</span>
              <span className="text-xs text-muted">
                {n ? (owner ? formatSoles(sum(lots.filter((l) => l.bucket === g.bucket))) : g.hint) : "Nada aquí"}
              </span>
            </a>
          );
        })}
      </div>
      <div className="flex flex-col gap-5">
        {GROUPS.map((g) => {
          const items = lots.filter((l) => l.bucket === g.bucket);
          if (!items.length) return null;
          const value = items.some((l) => l.value !== null) ? items.reduce((s, l) => s + (l.value ?? 0), 0) : null;
          return (
            <section key={g.bucket} id={g.bucket} className="lista scroll-mt-6">
              <header className={`flex items-center justify-between gap-2 px-4 py-3 ${g.head}`}>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 font-bold">
                    {g.title}
                    <span className={`chip ${g.chip}`}>
                      {items.length} lote{items.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <p className="text-xs text-muted">{g.hint}</p>
                </div>
                {value !== null && <span className={`cifra ${g.figure}`}>{formatSoles(value)}</span>}
              </header>
              <ul className="celdas">
                {items.map((l, i) => {
                  const [, m, d] = l.expiresOn.split("-");
                  return (
                    <li key={i} className="fila flex items-center gap-3">
                      <span aria-hidden className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${g.tile}`}>
                        <span className="cifra text-base">{Number(d)}</span>
                        <span className="text-[10px] font-semibold uppercase">{MONTHS[Number(m) - 1]}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        {l.value !== null ? (
                          <Link
                            href={`/productos/${l.productId}/movimientos`}
                            className="block truncate font-semibold leading-tight hover:text-primary"
                          >
                            {l.productName}
                          </Link>
                        ) : (
                          <p className="truncate font-semibold leading-tight">{l.productName}</p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="chip bg-slate-100 text-slate-700">{l.location}</span>
                          <span className={`chip ${g.chip}`}>{when(l.days)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="cifra text-[15px]">{formatQty(l.quantity, l.packagings)}</p>
                        {l.value !== null && <p className="text-xs text-muted">{formatSoles(l.value)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
