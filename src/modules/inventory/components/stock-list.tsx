import Link from "next/link";
import { Stat } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSoles } from "@/lib/money";
import { daysUntil, todayInLima } from "../expiry";
import { formatDate, formatQty } from "../format";
import type { StockItem } from "../queries";

const NO_SUPPLIER = "Sin proveedor";
const STATUS = {
  out: { label: "Agotado", className: "bg-red-100 text-red-700", bar: "bg-red-600" },
  low: { label: "Bajo", className: "bg-amber-100 text-amber-800", bar: "bg-amber-600" },
  ok: { label: "OK", className: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-600" },
} as const;

/** Expiry chip color by how close the date is. */
const expiryTone = (days: number) =>
  days < 0
    ? "bg-red-100 text-red-800"
    : days <= 30
      ? "bg-amber-100 text-amber-800"
      : days <= 90
        ? "bg-yellow-50 text-yellow-800"
        : "bg-slate-100 text-slate-700";

/**
 * Summary strip, then products grouped by main supplier (alphabetical, "Sin proveedor" last), each with its status
 * against the minimum. Tapping a product shows its lots by floor and expiry.
 */
export function StockList({
  items,
  expiring,
  canBuy,
  onlyMissing = false,
}: {
  items: StockItem[];
  expiring: number;
  canBuy: boolean;
  /** "Stock bajo": most urgent first, a bar against the minimum, and one "Armar lista" per supplier. */
  onlyMissing?: boolean;
}) {
  const low = items.filter((p) => p.status === "low").length;
  const out = items.filter((p) => p.status === "out").length;
  const showValue = items.some((p) => p.value !== null);
  const today = todayInLima();

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {onlyMissing ? (
          <Stat label="Proveedores a pedir" value={new Set(items.map((p) => p.supplierName ?? NO_SUPPLIER)).size} />
        ) : (
          <Stat label="Productos" value={items.length} />
        )}
        <Stat href="/stock?falta=1" label="Bajo el mínimo" value={low} tone={low ? "text-amber-700" : ""} />
        <Stat href="/stock?falta=1" label="Agotados" value={out} tone={out ? "text-red-700" : ""} />
        {showValue ? (
          <Stat label="Valor a costo" value={formatSoles(items.reduce((s, p) => s + (p.value ?? 0), 0))} />
        ) : (
          <Stat href="/vencimientos" label="Por vencer" value={expiring} tone={expiring ? "text-amber-700" : ""} />
        )}
      </div>

      {!items.length ? (
        onlyMissing ? (
          <EmptyState text="Todo está sobre su mínimo. No hace falta pedir nada." tone="bg-emerald-50 text-emerald-600" />
        ) : (
          <EmptyState text="No hay productos con ese filtro." />
        )
      ) : (
        <div className="flex flex-col gap-5">
          {[...Map.groupBy(items, (p) => p.supplierName ?? NO_SUPPLIER)]
            .sort(([a], [b]) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b)))
            .map(([supplier, all]) => {
              // Stock bajo: agotados first, then the lowest against their minimum.
              const list = onlyMissing ? all.toSorted((a, b) => a.total / (a.minStock || 1) - b.total / (b.minStock || 1)) : all;
              const gLow = list.filter((p) => p.status === "low").length;
              const gOut = list.filter((p) => p.status === "out").length;
              return (
                <section key={supplier} className="lista">
                  <header className="flex flex-wrap items-center gap-3 bg-slate-50/70 px-4 py-3">
                    <Avatar name={supplier} size="sm" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h2 className="truncate font-bold leading-tight">{supplier}</h2>
                      <div className="flex flex-wrap gap-1">
                        <span className="chip bg-slate-100 text-slate-700">
                          {list.length} producto{list.length === 1 ? "" : "s"}
                        </span>
                        {gLow > 0 && (
                          <span className="chip bg-amber-100 text-amber-800">
                            {gLow} bajo{gLow === 1 ? "" : "s"}
                          </span>
                        )}
                        {gOut > 0 && (
                          <span className="chip bg-red-100 text-red-700">
                            {gOut} agotado{gOut === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                    {canBuy && (gLow > 0 || gOut > 0) && (
                      <Link
                        href={list[0].supplierId && supplier !== NO_SUPPLIER ? `/compras/nueva?proveedor=${list[0].supplierId}` : "/compras/nueva"}
                        className={`${onlyMissing ? "btn-primario" : "btn-suave"} flex h-9 shrink-0 items-center px-3 text-sm`}
                      >
                        Armar lista
                      </Link>
                    )}
                  </header>
                  {/* Desktop: two independent columns (first half | second half), so opening a product only pushes the
                      ones below it in its own column. Phone: the halves stack, keeping the original order. */}
                  <div className="grid items-start lg:grid-cols-2">
                    {[list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))].map((col, c) => (
                      <ul key={c} className={c === 0 ? "lg:border-r lg:border-slate-100" : ""}>
                        {col.map((p) => (
                          <li key={p.id} className="fila border-t border-slate-100">
                            <details className="group">
                              <summary className="flex cursor-pointer list-none items-center gap-3">
                                <span className={`h-10 w-1.5 shrink-0 rounded-full ${STATUS[p.status].bar}`} aria-hidden />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold leading-tight">{p.name}</p>
                                  <p className="truncate text-xs text-muted">
                                    {p.sku} · {p.category}
                                  </p>
                                  {onlyMissing && p.minStock > 0 && (
                                    <span className="mt-1.5 flex items-center gap-2">
                                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                        <span
                                          className={`block h-full rounded-full ${STATUS[p.status].bar}`}
                                          style={{ width: `${Math.min(100, (p.total / p.minStock) * 100)}%` }}
                                        />
                                      </span>
                                      <span className="shrink-0 text-[11px] text-muted">mín. {formatQty(p.minStock, p.packagings)}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className={`cifra text-[15px] ${p.total ? "" : "text-red-600"}`}>
                                    {p.total ? formatQty(p.total, p.packagings) : "Sin stock"}
                                  </span>
                                  <span className="flex flex-wrap justify-end gap-1">
                                    {p.status === "low" && (
                                      <span className="chip bg-amber-50 text-amber-800">faltan {formatQty(p.minStock - p.total, p.packagings)}</span>
                                    )}
                                    <span className={`chip ${STATUS[p.status].className}`}>{STATUS[p.status].label}</span>
                                  </span>
                                </div>
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#94A3B8"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  className="shrink-0 transition group-open:rotate-90"
                                  aria-hidden
                                >
                                  <path d="M9 6l6 6-6 6" />
                                </svg>
                              </summary>
                              <div className="mt-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
                                {p.lots.length ? (
                                  p.lots.map((l, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                                      <span className="chip bg-white text-slate-700 ring-1 ring-border">{l.location}</span>
                                      {l.expiresOn ? (
                                        <span className={`chip ${expiryTone(daysUntil(l.expiresOn, today))}`}>vence {formatDate(l.expiresOn)}</span>
                                      ) : (
                                        <span className="chip bg-slate-100 text-muted">sin vencimiento</span>
                                      )}
                                      <span className="cifra ml-auto">{formatQty(l.quantity, p.packagings)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted">Sin lotes en almacén.</p>
                                )}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                  {p.value !== null && p.total > 0 && (
                                    <span className="text-xs text-muted">Valor a costo {formatSoles(p.value)}</span>
                                  )}
                                  {p.value !== null && (
                                    <Link href={`/productos/${p.id}/movimientos`} className="btn-suave h-8 px-3 text-xs">
                                      Ver movimientos
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </details>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </>
  );
}
