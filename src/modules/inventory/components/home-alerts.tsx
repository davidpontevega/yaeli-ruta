import Link from "next/link";

type Alert = { href: string; count: number; title: string; detail: string; tone: string };

/** "Necesita atención": one row per alert with its count; rows at 0 say all is fine. */
export function HomeAlerts({
  expired,
  within30,
  lowStock,
  priceReview,
}: {
  expired: number;
  within30: number;
  lowStock: number;
  priceReview: number | null; // null = not the owner: prices are owner-only
}) {
  const alerts: Alert[] = [
    { href: "/vencimientos", count: expired, title: "Lotes vencidos", detail: "Sácalos del almacén", tone: "bg-red-100 text-red-800" },
    { href: "/vencimientos", count: within30, title: "Vencen en 30 días", detail: "Véndelos primero", tone: "bg-amber-100 text-amber-800" },
    { href: "/stock?falta=1", count: lowStock, title: "Stock bajo", detail: "Arma la lista de pedido", tone: "bg-orange-100 text-orange-800" },
  ];
  if (priceReview !== null)
    alerts.push({ href: "/precios", count: priceReview, title: "Precios por revisar", detail: "Subió el costo", tone: "bg-sky-100 text-sky-800" });
  return (
    <section className="flex flex-col gap-2">
      <h2 className="rotulo px-1 pt-1">Necesita atención</h2>
      {alerts.map((a) => (
        <Link key={a.title} href={a.href} className="tarjeta flex min-h-14 items-center gap-3 px-3.5 py-3">
          <span
            className={`cifra flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[17px] ${a.count ? a.tone : "bg-slate-100 text-muted"}`}
          >
            {a.count}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{a.title}</span>
            <span className="text-xs text-muted">{a.count ? a.detail : "Todo bien"}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      ))}
    </section>
  );
}
