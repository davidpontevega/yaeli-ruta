import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { ICONS, IconTile } from "@/components/ui/avatar";
import { formatSoles } from "@/lib/money";
import { formatDate, formatQty } from "../format";
import { MOVEMENT_LIMIT, type Movement } from "../queries";

const TYPE: Record<Movement["type"], { label: string; icon: string; tone: string }> = {
  INGRESO: { label: "Llegó mercadería", icon: ICONS.truck, tone: "bg-emerald-50 text-emerald-700" },
  SALDO_INICIAL: { label: "Saldo inicial", icon: ICONS.box, tone: "bg-slate-100 text-slate-600" },
  VENTA: { label: "Venta", icon: ICONS.users, tone: "bg-sky-50 text-sky-700" },
  TRASLADO: { label: "Traslado", icon: ICONS.truck, tone: "bg-violet-50 text-violet-700" },
};
const LIMA = { timeZone: "America/Lima" } as const;
const dayOf = (d: Date) => d.toLocaleDateString("es-PE", { ...LIMA, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeOf = (d: Date) => d.toLocaleTimeString("es-PE", { ...LIMA, hour: "2-digit", minute: "2-digit" });

/** Kardex: current stock and totals of the shown movements, then the movements grouped by day, newest first. */
export function MovementList({ movements, packagings }: { movements: Movement[]; packagings: { name: string; factor: number }[] }) {
  if (!movements.length) return <EmptyState text="Este producto aún no tiene movimientos." />;
  const fmt = (n: number) => (n ? formatQty(Math.abs(n), packagings) : "0");
  const sum = (sign: 1 | -1) => movements.reduce((s, m) => s + (Math.sign(m.quantity) === sign ? m.quantity : 0), 0);
  const days = Map.groupBy(movements, (m) => dayOf(new Date(m.createdAt)));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Stat label="Stock actual" value={fmt(movements[0].balance)} tone={movements[0].balance > 0 ? "text-primary" : "text-red-700"} />
        <Stat label="Entró" value={`+${fmt(sum(1))}`} tone="text-emerald-700" hint={`en estos ${movements.length} movimientos`} />
        <Stat label="Salió" value={`−${fmt(sum(-1))}`} tone="text-red-600" hint={`en estos ${movements.length} movimientos`} />
      </div>
      {movements.length === MOVEMENT_LIMIT && <p className="text-sm text-muted">Se muestran los últimos {MOVEMENT_LIMIT} movimientos.</p>}
      {[...days].map(([day, list]) => (
        <section key={day} className="lista">
          <h2 className="bg-slate-50/70 px-4 py-2.5 text-sm font-bold first-letter:uppercase">{day}</h2>
          <ul className="divide-y divide-slate-100">
            {list.map((m) => {
              const t = TYPE[m.type];
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <IconTile d={t.icon} tone={t.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">
                      {t.label}
                      {m.supplier && <span className="font-normal"> · {m.supplier}</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="chip bg-slate-100 text-slate-600">{timeOf(new Date(m.createdAt))}</span>
                      {m.document && <span className="chip bg-slate-100 text-slate-600">{m.document}</span>}
                      <span className="chip bg-slate-100 text-slate-600">{m.location}</span>
                      {m.expiresOn && <span className="chip bg-amber-50 text-amber-800">vence {formatDate(m.expiresOn)}</span>}
                      <span className="chip bg-slate-100 text-slate-600">{formatSoles(m.unitCost)} c/u</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`cifra text-[15px] ${m.quantity < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {m.quantity < 0 ? "−" : "+"}
                      {fmt(m.quantity)}
                    </p>
                    <p className="text-xs text-muted">quedó {fmt(m.balance)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
