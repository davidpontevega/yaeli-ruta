import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { Avatar, ICONS, IconTile } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/stat";
import { formatDate } from "@/lib/date";
import type { OrderDetail, OrderRow } from "../queries";

const STATUS = {
  PENDIENTE: { label: "Pendiente", className: "bg-amber-100 text-amber-800" },
  ENTREGADO: { label: "Entregado", className: "bg-emerald-100 text-emerald-800" },
  ANULADO: { label: "Anulado", className: "bg-slate-200 text-slate-600" },
} as const;

/** Day summary, then orders grouped by route in visit order (the query sorts them). Totals exclude cancelled orders. */
export function OrderList({ orders }: { orders: OrderRow[] }) {
  const live = orders.filter((o) => o.status !== "ANULADO");
  const pending = live.filter((o) => o.status === "PENDIENTE").length;
  const total = live.reduce((s, o) => s + o.total, 0);
  const groups = Map.groupBy(orders, (o) => o.routeName);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Pedidos del día" value={live.length} />
        <Stat label="Por entregar" value={pending} tone={pending ? "text-amber-700" : ""} />
        <Stat label="Entregados" value={live.length - pending} tone={live.length - pending ? "text-emerald-700" : ""} />
        <Stat label="Total del día" value={formatSoles(total)} tone="text-primary" />
      </div>
      {!orders.length ? (
        <EmptyState text="No hay pedidos para esa fecha." />
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups].map(([routeName, list]) => (
            <section key={routeName} className="lista">
              <header className="flex items-center gap-3 bg-slate-50/70 px-4 py-3">
                <IconTile d={ICONS.pin} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold leading-tight">{routeName}</h2>
                  <span className="chip mt-1 bg-slate-100 text-slate-700">
                    {list.length} pedido{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="cifra shrink-0">{formatSoles(list.filter((o) => o.status !== "ANULADO").reduce((s, o) => s + o.total, 0))}</span>
              </header>
              <ul className="celdas">
                {list.map((o) => (
                  <li key={o.id}>
                    <Link href={`/pedidos/${o.id}`} className={`fila flex items-center gap-3 ${o.status === "ANULADO" ? "opacity-50" : ""}`}>
                      <Avatar name={o.customerName} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-semibold leading-tight ${o.status === "ANULADO" ? "line-through" : ""}`}>{o.customerName}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="chip bg-slate-100 text-slate-600">#{o.number}</span>
                          <span className="chip bg-slate-100 text-slate-600">
                            {o.lines} producto{o.lines === 1 ? "" : "s"}
                          </span>
                          <span className={`chip ${STATUS[o.status].className}`}>{STATUS[o.status].label}</span>
                        </div>
                      </div>
                      <p className="cifra shrink-0 text-[15px]">{formatSoles(o.total)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only view of a closed order (cancelled or delivered). Delivered orders show what was delivered. */
export function OrderSummary({ order, customerName }: { order: OrderDetail; customerName: string }) {
  const delivered = order.status === "ENTREGADO";
  const cancelled = order.status === "ANULADO";
  const qty = (i: OrderDetail["items"][number]) => (delivered ? (i.delivered ?? 0) : i.quantity);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="tarjeta flex items-center gap-3 lg:col-start-2 lg:row-start-1">
        <Avatar name={customerName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{customerName}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`chip ${STATUS[order.status].className}`}>{STATUS[order.status].label}</span>
            <span className="chip bg-slate-100 text-slate-600">entrega {formatDate(order.deliveryOn)}</span>
            {!delivered && !cancelled && order.sheet?.status === "EN_RUTA" && (
              <span className="chip bg-teal-50 text-teal-800">En ruta · Hoja #{order.sheet.number}</span>
            )}
          </div>
        </div>
        <Link href={`/clientes/${order.customerId}/cuenta`} className="btn-suave flex h-10 shrink-0 items-center px-3 text-sm">
          Cuenta
        </Link>
      </div>
      <section className={`lista lg:row-span-2 ${cancelled ? "opacity-60" : ""}`}>
        <ul className="divide-y divide-slate-100">
          {order.items.map((i) => (
            <li key={i.packagingId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={i.productName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className={`font-semibold leading-tight ${cancelled ? "line-through" : ""}`}>{i.productName}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="chip bg-slate-100 text-slate-600">
                    {qty(i)} {i.packagingName} · {formatSoles(i.price)} c/u
                  </span>
                  {delivered && i.delivered !== i.quantity && <span className="chip bg-amber-100 text-amber-800">pidió {i.quantity}</span>}
                </div>
              </div>
              <span className="cifra shrink-0">{formatSoles(qty(i) * i.price)}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="tarjeta flex items-baseline justify-between lg:col-start-2">
        <span className="font-bold">{delivered ? "Total entregado" : cancelled ? "Total (anulado)" : "Total"}</span>
        <span className={`cifra text-2xl ${cancelled ? "text-slate-500 line-through" : "text-primary"}`}>{formatSoles(order.total)}</span>
      </div>
    </div>
  );
}
