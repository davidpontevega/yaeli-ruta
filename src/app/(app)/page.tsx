import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listPriceReview } from "@/modules/catalog";
import { HomeAlerts, MissingList, getAlertCounts, listStock, todayInLima } from "@/modules/inventory";
import { ReceivableCard, receivableSummary } from "@/modules/accounts";
import { TodayCard, TodayOrders, listOrders, todaySummary } from "@/modules/orders";
import { Kpi } from "@/components/ui/kpi";
import { canSee } from "@/lib/menus";

const dayLabel = () => new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" });

export default async function HomePage() {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  // Blocks of hidden menus are neither shown nor queried (spec 020). Every `can(...)` below is false for the repartidor on owner screens.
  const can = (href: string) => canSee(href, user.role, user.hiddenMenus);
  const [canOrder, canBuy] = [can("/pedidos/nuevo"), can("/compras/nueva")];
  const [counts, review, receivable, today, missing, todayOrders] = await Promise.all([
    getAlertCounts(), // the layout runs it on every request anyway
    can("/precios") && isOwner ? listPriceReview() : null,
    can("/clientes") ? receivableSummary() : null,
    can("/pedidos") ? todaySummary() : null,
    can("/stock") && isOwner ? listStock({ q: "", categoryId: "", supplierId: "", onlyMissing: true, withCost: false }) : null,
    can("/pedidos") ? listOrders({ date: todayInLima(), routeId: "", includeCancelled: false }) : null,
  ]);
  const suppliersMissing = [...new Set((missing ?? []).map((m) => m.supplierName ?? "Sin proveedor"))].slice(0, 2).join(" · ");
  const greeting = (
    <div className="flex flex-col">
      <span className="text-[13px] text-muted first-letter:uppercase">{dayLabel()}</span>
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Hola, {user.name}</h1>
    </div>
  );

  return (
    <>
      {/* Phone (and the repartidor everywhere): one column. */}
      <section className={`flex flex-col gap-3.5 ${isOwner ? "md:hidden" : ""}`}>
        {greeting}
        {receivable && <ReceivableCard summary={receivable} />}
        {(canOrder || canBuy) && (
          <div className={`grid gap-2.5 ${canOrder && canBuy ? "grid-cols-2" : "grid-cols-1"}`}>
            {canOrder && (
              <Link href="/pedidos/nuevo" className="btn-primario btn-pedido flex min-h-[84px] flex-col justify-between p-3.5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 3h2l2.5 12h11L21 7H6.2" />
                  <circle cx="9" cy="20" r="1" />
                  <circle cx="18" cy="20" r="1" />
                </svg>
                <span className="text-[15px]">Nuevo pedido</span>
              </Link>
            )}
            {canBuy && (
              <Link href="/compras/nueva" className="btn-primario btn-proveedor flex min-h-[84px] flex-col justify-between p-3.5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M1 3h15v13H1z" />
                  <path d="M16 8h4l3 3v5h-7z" />
                  <circle cx="5.5" cy="18.5" r="2" />
                  <circle cx="18.5" cy="18.5" r="2" />
                </svg>
                <span className="text-[15px]">Pedir a proveedor</span>
              </Link>
            )}
          </div>
        )}
        {today && <TodayCard today={today} />}
        <HomeAlerts {...counts} priceReview={review ? review.length : null} can={can} />
      </section>

      {/* Desktop owner: indicators in a row, then today's orders and what is missing side by side. */}
      {isOwner && (
        <section className="hidden flex-col gap-5 md:flex">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {greeting}
            <div className="flex gap-2">
              {canBuy && (
                <Link href="/compras/nueva" className="btn-primario btn-proveedor flex h-[42px] items-center text-sm">
                  Pedir a proveedor
                </Link>
              )}
              {canOrder && (
                <Link href="/pedidos/nuevo" className="btn-primario btn-pedido flex h-[42px] items-center text-sm">
                  Nuevo pedido
                </Link>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {receivable && <ReceivableCard summary={receivable} />}
            {today && (
              <Kpi href="/pedidos" label="Entregas de hoy" value={today.count ? `${today.delivered} de ${today.count}` : "0"}>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${today.count ? (today.delivered * 100) / today.count : 0}%` }} />
                </div>
              </Kpi>
            )}
            {missing && (
              <Kpi
                href="/stock?falta=1"
                label="Stock bajo o agotado"
                value={missing.length}
                valueClass={missing.length ? "text-orange-800" : ""}
                detail={suppliersMissing || "Todo bien"}
              />
            )}
            {can("/vencimientos") && (
              <Kpi
                href="/vencimientos"
                label="Por vencer en 30 días"
                value={counts.within30}
                valueClass={counts.within30 ? "text-amber-800" : ""}
                detail={
                  counts.expired
                    ? `${counts.expired} lote${counts.expired === 1 ? "" : "s"} ya vencido${counts.expired === 1 ? "" : "s"}`
                    : "Ninguno vencido"
                }
                detailClass={counts.expired ? "font-semibold text-red-700" : "text-muted"}
              />
            )}
          </div>
          {review && review.length > 0 && (
            <Link
              href="/precios"
              className="tarjeta flex items-center justify-between border-sky-300 bg-sky-50 py-3 text-sm font-medium text-sky-800"
            >
              {review.length} precio{review.length === 1 ? "" : "s"} por revisar: subió el costo <span aria-hidden>→</span>
            </Link>
          )}
          <div className="grid items-start gap-4 lg:grid-cols-5">
            {todayOrders && (
              <div className={missing ? "lg:col-span-3" : "lg:col-span-5"}>
                <TodayOrders orders={todayOrders} />
              </div>
            )}
            {missing && (
              <div className={todayOrders ? "lg:col-span-2" : "lg:col-span-5"}>
                <MissingList items={missing.slice(0, 6)} more={Math.max(0, missing.length - 6)} />
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
