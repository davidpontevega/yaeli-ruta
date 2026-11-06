import { formatSoles } from "@/lib/money";
import type { ExpiryBucket } from "../expiry";
import { formatDate, formatQty } from "../format";
import type { ExpiringLot } from "../queries";

const GROUPS: { bucket: ExpiryBucket; title: string; className: string }[] = [
  { bucket: "expired", title: "Vencidos", className: "border-red-300 bg-red-50 text-red-800" },
  { bucket: "30", title: "En 30 días", className: "border-amber-300 bg-amber-50 text-amber-800" },
  { bucket: "60", title: "En 31–60 días", className: "border-yellow-200 bg-yellow-50 text-yellow-800" },
  { bucket: "90", title: "En 61–90 días", className: "border-border bg-slate-50 text-slate-700" },
];

const when = (days: number) =>
  days < 0 ? `venció hace ${-days} día${days === -1 ? "" : "s"}` : days === 0 ? "vence hoy" : `vence en ${days} día${days === 1 ? "" : "s"}`;

export function ExpiryList({ lots }: { lots: ExpiringLot[] }) {
  if (!lots.length) return <p className="tarjeta text-muted">Nada por vencer en 90 días.</p>;
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((g) => {
        const items = lots.filter((l) => l.bucket === g.bucket);
        if (!items.length) return null;
        const value = items.some((l) => l.value !== null) ? items.reduce((s, l) => s + (l.value ?? 0), 0) : null;
        return (
          <section key={g.bucket} className="flex flex-col gap-2">
            <h2 className={`flex items-center justify-between rounded-xl border px-3 py-2 font-semibold ${g.className}`}>
              <span>
                {g.title} · {items.length}
              </span>
              {value !== null && <span className="text-sm">{formatSoles(value)}</span>}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((l, i) => (
                <li key={i} className="tarjeta flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold leading-tight">{l.productName}</p>
                    <p className="text-xs text-muted">
                      {l.location} · {formatDate(l.expiresOn)} · <b>{when(l.days)}</b>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatQty(l.quantity, l.packagings)}</p>
                    {l.value !== null && <p className="text-xs text-muted">{formatSoles(l.value)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
