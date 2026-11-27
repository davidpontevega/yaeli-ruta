import Link from "next/link";
import { formatQty } from "@/lib/quantity";
import type { StockItem } from "../queries";

const STATUS = {
  out: { label: "Agotado", chip: "bg-red-100 text-red-800", bar: "bg-red-600" },
  low: { label: "Bajo", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-600" },
  ok: { label: "OK", chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-600" },
} as const;

/** "Lo que falta pedir": low or out-of-stock products with their supplier and what is missing. */
export function MissingList({ items, more }: { items: StockItem[]; more: number }) {
  return (
    <section className="tarjeta flex flex-col gap-1 px-[18px]">
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-[15px] font-bold">Lo que falta pedir</h2>
        <Link href="/compras/nueva" className="text-sm font-semibold text-primary">
          Armar compra
        </Link>
      </div>
      {items.length ? (
        items.map((p) => (
          <Link
            key={p.id}
            href={`/stock?proveedor=${p.supplierId ?? "none"}&falta=1`}
            className="flex items-center gap-2.5 border-t border-slate-100 py-2"
          >
            <span className={`h-7 w-2 shrink-0 rounded-full ${STATUS[p.status].bar}`} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{p.name}</span>
              <span className="text-xs text-muted">
                {p.supplierName ?? "Sin proveedor"}
                {p.status === "low" ? ` · faltan ${formatQty(p.minStock - p.total, p.packagings)}` : ""}
              </span>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[p.status].chip}`}>{STATUS[p.status].label}</span>
          </Link>
        ))
      ) : (
        <p className="pb-3 text-sm text-muted">Todo el stock está sobre el mínimo.</p>
      )}
      {more > 0 && (
        <Link href="/stock?falta=1" className="border-t border-slate-100 py-2 text-sm font-semibold text-primary">
          Ver {more} más
        </Link>
      )}
    </section>
  );
}
