import Link from "next/link";

type Alert = { href: string; count: number; value?: string; title: string; detail: string; ok: string; tone: string };

/** "Hoy": one row per alert that needs something; the ones at 0 go together in a single "Todo bien: …" line. */
export function HomeAlerts({
  expired,
  within7,
  lowStock,
  today,
  onRoad,
  priceReview,
  can,
}: {
  expired: number;
  within7: number;
  lowStock: number;
  today: { count: number; delivered: number } | null; // null = cannot see orders
  onRoad: number | null; // sheets EN_RUTA today; null = cannot see Reparto
  priceReview: number | null; // null = not the owner: prices are owner-only
  can: (href: string) => boolean; // whether this user sees the screen (hidden menus)
}) {
  const alerts: Alert[] = [
    {
      href: "/vencimientos",
      count: expired,
      title: "Lotes vencidos",
      detail: "Sácalos del almacén",
      ok: "nada vencido",
      tone: "bg-red-100 text-red-800",
    },
    {
      href: "/vencimientos",
      count: within7,
      title: "Vencen esta semana",
      detail: "Véndelos primero",
      ok: "nada vence esta semana",
      tone: "bg-amber-100 text-amber-800",
    },
    {
      href: "/stock?falta=1",
      count: lowStock,
      title: "Stock bajo",
      detail: "Pídelo al proveedor",
      ok: "stock completo",
      tone: "bg-orange-100 text-orange-800",
    },
  ];
  if (today)
    alerts.push({
      href: "/pedidos",
      count: today.count - today.delivered,
      value: `${today.delivered}/${today.count}`,
      title: "Entregas de hoy",
      detail: `${today.delivered} de ${today.count} entregados`,
      ok: today.count ? "todo entregado" : "sin entregas hoy",
      tone: "bg-teal-100 text-teal-800",
    });
  if (onRoad !== null)
    alerts.push({
      href: "/reparto",
      count: onRoad,
      title: "Hojas en ruta hoy",
      detail: "Ciérralas al volver",
      ok: "ninguna hoja en ruta",
      tone: "bg-sky-100 text-sky-800",
    });
  if (priceReview !== null)
    alerts.push({
      href: "/precios",
      count: priceReview,
      title: "Precios por revisar",
      detail: "Subió el costo",
      ok: "precios al día",
      tone: "bg-sky-100 text-sky-800",
    });
  const shown = alerts.filter((a) => can(a.href));
  if (!shown.length) return null;
  const rows = shown.filter((a) => a.count > 0);
  const fine = shown.filter((a) => a.count <= 0);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="rotulo px-1 pt-1">Hoy</h2>
      {rows.map((a) => (
        <Link key={a.title} href={a.href} className="tarjeta flex min-h-14 items-center gap-3 px-3.5 py-3">
          <span className={`cifra flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-1.5 text-[17px] ${a.tone}`}>
            {a.value ?? a.count}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{a.title}</span>
            <span className="text-xs text-muted">{a.detail}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      ))}
      {fine.length > 0 && (
        <p className="tarjeta px-3.5 py-3 text-sm text-emerald-800">
          <span className="font-semibold">Todo bien:</span> {fine.map((a) => a.ok).join(" · ")}
        </p>
      )}
    </section>
  );
}
