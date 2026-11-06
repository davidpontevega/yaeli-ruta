import { formatSoles } from "@/lib/money";
import { formatDate, formatQty } from "../format";
import type { StockItem } from "../queries";

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
      <ul className="flex flex-col gap-2">
        {items.map((p) => (
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
                  <p className={`font-semibold ${p.total ? "" : "text-red-600"}`}>{p.total ? formatQty(p.total, p.packagings) : "Sin stock"}</p>
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
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
