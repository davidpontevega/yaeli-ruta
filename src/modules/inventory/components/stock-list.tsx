import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { formatDate, formatQty } from "../format";
import type { StockItem } from "../queries";

const NO_SUPPLIER = "Sin proveedor";
const STATUS = {
  out: { label: "Agotado", className: "bg-red-100 text-red-700" },
  low: { label: "Bajo", className: "bg-amber-100 text-amber-800" },
  ok: { label: "OK", className: "bg-emerald-100 text-emerald-800" },
} as const;

/** Grouped by main supplier (alphabetical, "Sin proveedor" last), each product with its status against the minimum. */
export function StockList({ items }: { items: StockItem[] }) {
  if (!items.length) return <p className="tarjeta text-muted">No hay productos con ese filtro.</p>;
  const totalValue = items.reduce((s, p) => s + (p.value ?? 0), 0);
  const showValue = items.some((p) => p.value !== null);

  return (
    <>
      {showValue && (
        <p className="text-sm text-muted">
          Valor del stock (a costo): <b className="text-foreground">{formatSoles(totalValue)}</b>
        </p>
      )}
      {[...Map.groupBy(items, (p) => p.supplierName ?? NO_SUPPLIER)]
        .sort(([a], [b]) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b)))
        .map(([supplier, list]) => {
          const low = list.filter((p) => p.status === "low").length;
          const out = list.filter((p) => p.status === "out").length;
          return (
            <section key={supplier} className="flex flex-col gap-2">
              <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold uppercase text-muted">
                {supplier}
                <span className="text-xs font-normal normal-case">
                  {list.length} producto{list.length === 1 ? "" : "s"}
                  {low > 0 && ` · ${low} bajo${low === 1 ? "" : "s"}`}
                  {out > 0 && ` · ${out} agotado${out === 1 ? "" : "s"}`}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((p) => (
                  <li key={p.id} className="tarjeta">
                    <details>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{p.name}</p>
                          <p className="text-xs text-muted">
                            {p.sku} · {p.category}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[p.status].className}`}>
                            {STATUS[p.status].label}
                          </span>
                          <p className={`font-semibold ${p.total ? "" : "text-red-600"}`}>
                            {p.total ? formatQty(p.total, p.packagings) : "Sin stock"}
                          </p>
                          {p.status === "low" && <p className="text-xs text-amber-800">faltan {formatQty(p.minStock - p.total, p.packagings)}</p>}
                          {p.value !== null && p.total > 0 && <p className="text-xs text-muted">{formatSoles(p.value)}</p>}
                        </div>
                      </summary>
                      {p.lots.length > 0 && (
                        <table className="mt-3 w-full text-sm">
                          <thead className="text-left text-xs text-muted">
                            <tr>
                              <th className="font-medium">Ubicación</th>
                              <th className="font-medium">Vence</th>
                              <th className="text-right font-medium">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.lots.map((l, i) => (
                              <tr key={i} className="border-t border-border">
                                <td className="py-1">{l.location}</td>
                                <td>{l.expiresOn ? formatDate(l.expiresOn) : "—"}</td>
                                <td className="text-right">{formatQty(l.quantity, p.packagings)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {p.value !== null && (
                        <Link href={`/productos/${p.id}/movimientos`} className="mt-3 inline-block text-sm font-medium text-primary">
                          Movimientos →
                        </Link>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </>
  );
}
