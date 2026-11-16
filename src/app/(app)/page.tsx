import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listPriceReview } from "@/modules/catalog";
import { HomeAlerts, getAlertCounts } from "@/modules/inventory";
import { ReceivableCard, receivableSummary } from "@/modules/accounts";
import { TodayCard, todaySummary } from "@/modules/orders";

const dayLabel = () => new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" });

export default async function HomePage() {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const [counts, review, receivable, today] = await Promise.all([
    getAlertCounts(),
    isOwner ? listPriceReview() : null,
    isOwner ? receivableSummary() : null,
    isOwner ? todaySummary() : null,
  ]);
  return (
    <section className="flex flex-col gap-3.5">
      <header className="flex flex-col">
        <span className="text-[13px] text-muted first-letter:uppercase">{dayLabel()}</span>
        <h1 className="text-[22px] font-bold tracking-tight">Hola, {user.name}</h1>
      </header>
      {receivable && <ReceivableCard summary={receivable} />}
      {isOwner && (
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/pedidos/nuevo" className="btn-primario flex min-h-[84px] flex-col justify-between p-3.5">
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
          <Link href="/compras/nueva" className="btn-secundario flex min-h-[84px] flex-col justify-between p-3.5">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F766E"
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
            <span className="text-[15px]">Nueva compra</span>
          </Link>
        </div>
      )}
      {today && <TodayCard today={today} />}
      <HomeAlerts {...counts} priceReview={review ? review.length : null} />
    </section>
  );
}
