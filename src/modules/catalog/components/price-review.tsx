import { formatSoles } from "@/lib/money";
import { applyPrices } from "../actions";
import type { PriceReviewItem } from "../queries";

export function PriceReview({ items }: { items: PriceReviewItem[] }) {
  if (!items.length) return <p className="tarjeta text-muted">Todos los precios cubren su margen.</p>;
  return (
    <form action={applyPrices} className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.packagingId}>
            <label className="tarjeta flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="packagingId" value={r.packagingId} defaultChecked className="mt-1 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">
                  {r.productName}{" "}
                  <span className="font-normal text-muted">
                    · {r.packagingName}
                    {r.factor > 1 && ` ×${r.factor}`}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  Costo {formatSoles(r.cost)} · margen <b className={r.marginPct < r.targetPct ? "text-red-600" : ""}>{r.marginPct}%</b> (quieres{" "}
                  {r.targetPct}%)
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm text-muted line-through">{formatSoles(r.price)}</p>
                <p className="font-semibold text-primary">{formatSoles(r.suggested)}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <button className="btn-primario h-12">Aplicar precios marcados</button>
    </form>
  );
}
