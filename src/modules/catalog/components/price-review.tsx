import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSoles } from "@/lib/money";
import { applyPrices } from "../actions";
import type { PriceReviewItem } from "../queries";

/** One card per packaging below its target margin: cost, margin now vs wanted, and the price change (old → suggested). */
export function PriceReview({ items }: { items: PriceReviewItem[] }) {
  if (!items.length) return <EmptyState text="Todos los precios cubren su margen." tone="bg-emerald-50 text-emerald-600" />;
  return (
    <form action={applyPrices} className="flex flex-col gap-3">
      <ul className="grid items-start gap-3 lg:grid-cols-2">
        {items.map((r) => (
          <li key={r.packagingId}>
            <label className="tarjeta flex cursor-pointer flex-col gap-3 transition has-[:checked]:border-teal-300 has-[:checked]:ring-2 has-[:checked]:ring-teal-100">
              <div className="flex items-start gap-3">
                <Avatar name={r.productName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{r.productName}</p>
                  <span className="chip mt-1 bg-slate-100 text-slate-700">
                    {r.packagingName}
                    {r.factor > 1 && ` ×${r.factor}`}
                  </span>
                </div>
                <input type="checkbox" name="packagingId" value={r.packagingId} defaultChecked className="mt-1 size-5 shrink-0" />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="chip bg-slate-100 text-slate-700">Costo {formatSoles(r.cost)}</span>
                <span className={`chip ${r.marginPct < r.targetPct ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                  Ganas {r.marginPct}%
                </span>
                <span className="chip bg-teal-50 text-teal-800">Quieres {r.targetPct}%</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-muted">Precio actual</span>
                  <span className="cifra text-slate-500 line-through">{formatSoles(r.price)}</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-muted">Sugerido</span>
                  <span className="cifra text-lg text-primary">{formatSoles(r.suggested)}</span>
                </div>
                <span className="chip ml-auto bg-teal-50 text-teal-800">+{formatSoles(r.suggested - r.price)}</span>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
        <button className="btn-primario h-[52px] w-full text-base">
          Aplicar precios marcados · {items.length} sugerido{items.length === 1 ? "" : "s"}
        </button>
      </div>
    </form>
  );
}
