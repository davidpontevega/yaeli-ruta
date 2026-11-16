import Link from "next/link";
import { formatSoles } from "@/lib/money";
import type { OrderRow } from "../queries";

const STATUS = {
  PENDIENTE: { label: "Pendiente", className: "bg-slate-100 text-slate-700" },
  ENTREGADO: { label: "Entregado", className: "bg-emerald-100 text-emerald-800" },
  ANULADO: { label: "Anulado", className: "bg-slate-100 text-muted" },
} as const;

/** "Pedidos de hoy" for the desktop home. */
export function TodayOrders({ orders }: { orders: OrderRow[] }) {
  return (
    <section className="tarjeta overflow-hidden p-0">
      <div className="flex items-center justify-between px-[18px] py-3.5">
        <h2 className="text-[15px] font-bold">Pedidos de hoy</h2>
        <Link href="/pedidos" className="text-sm font-semibold text-primary">
          Ver todos
        </Link>
      </div>
      {orders.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-muted">
                <th className="px-[18px] py-2.5 font-semibold">N°</th>
                <th className="px-2 py-2.5 font-semibold">Cliente</th>
                <th className="px-2 py-2.5 font-semibold">Ruta</th>
                <th className="px-2 py-2.5 font-semibold">Estado</th>
                <th className="px-[18px] py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-[18px] py-3 text-muted">
                    <Link href={`/pedidos/${o.id}`}>#{o.number}</Link>
                  </td>
                  <td className="px-2 py-3 font-semibold">
                    <Link href={`/pedidos/${o.id}`}>{o.customerName}</Link>
                  </td>
                  <td className="px-2 py-3 text-muted">{o.routeName}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[o.status].className}`}>{STATUS[o.status].label}</span>
                  </td>
                  <td className="cifra px-[18px] py-3 text-right">{formatSoles(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-[18px] pb-5 text-sm text-muted">No hay pedidos para entregar hoy.</p>
      )}
    </section>
  );
}
