import Link from "next/link";
import { formatSoles } from "@/lib/money";
import type { OrderDetail, OrderRow } from "../queries";

/** Orders of one delivery date grouped by route, in visit order (the query sorts them). Total counts pending orders only. */
export function OrderList({ orders }: { orders: OrderRow[] }) {
  if (!orders.length) return <p className="tarjeta text-muted">No hay pedidos para esa fecha.</p>;
  const groups = Map.groupBy(orders, (o) => o.routeName);
  const total = orders.filter((o) => o.status === "PENDIENTE").reduce((s, o) => s + o.total, 0);
  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([routeName, list]) => (
        <section key={routeName} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase text-muted">{routeName}</h2>
          <ul className="flex flex-col gap-2">
            {list.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/pedidos/${o.id}`}
                  className={`tarjeta flex items-center gap-3 ${o.status === "ANULADO" ? "line-through opacity-50" : ""}`}
                >
                  <span className="w-10 shrink-0 text-sm text-muted">#{o.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{o.customerName}</p>
                    <p className="text-xs text-muted">
                      {o.lines} línea{o.lines === 1 ? "" : "s"}
                      {o.status === "ANULADO" && " · anulado"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatSoles(o.total)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="flex justify-between text-lg font-bold">
        <span>Total del día</span>
        <span>{formatSoles(total)}</span>
      </p>
    </div>
  );
}

/** Read-only view of a closed (cancelled) order. */
export function OrderSummary({ order, customerName }: { order: OrderDetail; customerName: string }) {
  return (
    <div className="tarjeta flex flex-col gap-2">
      <p className="font-semibold">
        {customerName} <span className="text-sm font-normal text-red-600">· anulado</span>
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {order.items.map((i) => (
          <li key={i.packagingId} className="flex justify-between gap-2">
            <span>
              {i.quantity} {i.packagingName} · {i.productName}
            </span>
            <span>{formatSoles(i.quantity * i.price)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between font-bold">
        <span>Total</span>
        <span>{formatSoles(order.total)}</span>
      </p>
    </div>
  );
}
