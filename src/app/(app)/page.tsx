import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listPriceReview } from "@/modules/catalog";
import { HomeAlerts, getAlertCounts, todayInLima } from "@/modules/inventory";
import { ReceivableCard, receivableSummary } from "@/modules/accounts";
import { todaySummary } from "@/modules/orders";
import { listSheets } from "@/modules/delivery";
import { ICONS, IconTile } from "@/components/ui/avatar";
import { canSee } from "@/lib/menus";

const dayLabel = () => new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" });

const ACTIONS = [
  { href: "/pedidos/nuevo", label: "Anotar pedido", icon: ICONS.pencil },
  { href: "/recepciones/nueva", label: "Llegó mercadería", icon: ICONS.box },
  { href: "/compras", label: "Pedir a proveedores", icon: ICONS.phone },
  { href: "/reparto", label: "Salir a repartir", icon: ICONS.truck },
  { href: "/stock", label: "Ver mi stock", icon: ICONS.box },
  { href: "/productos/catalogo", label: "Catálogo", icon: ICONS.users },
];

export default async function HomePage() {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  // Blocks of hidden menus are neither shown nor queried (spec 020). Every `can(...)` below is false for the repartidor on owner screens.
  const can = (href: string) => canSee(href, user.role, user.hiddenMenus);
  const [counts, review, receivable, today, sheets] = await Promise.all([
    getAlertCounts(), // the layout runs it on every request anyway
    can("/precios") && isOwner ? listPriceReview() : null,
    can("/clientes") ? receivableSummary() : null,
    can("/pedidos") ? todaySummary() : null,
    // ponytail: only today's sheets; an EN_RUTA sheet from an earlier day is not counted (countOnRoad() without date if it happens).
    can("/reparto") ? listSheets(todayInLima()) : null,
  ]);
  const actions = ACTIONS.filter((a) => can(a.href));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-3.5">
      <div className="flex flex-col">
        <span className="text-[13px] text-muted first-letter:uppercase">{dayLabel()}</span>
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Hola, {user.name}</h1>
      </div>
      <HomeAlerts
        expired={counts.expired}
        within7={counts.within7}
        lowStock={counts.lowStock}
        today={today}
        onRoad={sheets ? sheets.filter((s) => s.status === "EN_RUTA").length : null}
        priceReview={review ? review.length : null}
        can={can}
      />
      {actions.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {actions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${i === 0 ? "btn-primario" : "btn-secundario"} flex min-h-[84px] flex-col items-start justify-between gap-2 p-3.5`}
            >
              <IconTile d={a.icon} tone={i === 0 ? "bg-white/15 text-white" : "bg-teal-50 text-teal-700"} />
              <span className="text-[15px] font-semibold">{a.label}</span>
            </Link>
          ))}
        </div>
      )}
      {receivable && <ReceivableCard summary={receivable} />}
    </section>
  );
}
