"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/server/db/schema";
import { canSee } from "@/lib/menus";

/** `also`: pages reached from inside this tab (buttons), so the tab stays highlighted there. */
/** `short`: label for the phone segmented tabs when the full one does not fit. */
/** Who sees a tab (role + hidden menus) comes from src/lib/menus.ts by its href. */
type Tab = { href: string; label: string; short?: string; icon?: string; also?: string[] };
type Section = { label: string; icon: string; tabs: Tab[] };

// 4 sections × 2–3 tabs. Less frequent screens live behind buttons inside their tab.
const SECTIONS: Section[] = [
  { label: "Inicio", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z", tabs: [{ href: "/", label: "Inicio" }] },
  {
    label: "Ventas",
    icon: "M3 3h2l2.5 12h11L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    tabs: [
      {
        href: "/pedidos",
        label: "Pedidos",
        icon: "M3 3h2l2.5 12h11L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
      },
      {
        href: "/clientes",
        label: "Clientes",
        icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
        also: ["/deudores", "/rutas"],
      },
      {
        href: "/reparto",
        label: "Reparto",
        icon: "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
      },
    ],
  },
  {
    label: "Almacén",
    icon: "M3 8l9-5 9 5v12H3zM7 20v-8h10v8M7 15h10",
    tabs: [
      { href: "/stock", label: "Stock", icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" },
      {
        href: "/vencimientos",
        label: "Por vencer",
        icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 14v3M12 20h.01",
      },
      {
        href: "/compras",
        label: "Lista de pedido",
        short: "Lista",
        icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6",
        also: ["/proveedores"],
      },
      {
        href: "/recepciones/nueva",
        label: "Ingreso de mercadería",
        short: "Ingreso",
        icon: "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
        also: ["/recepciones"],
      },
    ],
  },
  {
    label: "Más",
    icon: "M4 6h16M4 12h16M4 18h16",
    tabs: [
      {
        href: "/productos",
        label: "Productos",
        icon: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
        also: ["/precios"],
      },
      {
        href: "/productos/catalogo",
        label: "Catálogo",
        icon: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
        also: ["/productos/fotos"],
      },
      {
        href: "/catalogo",
        label: "Ajustes",
        icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
        also: ["/usuarios"],
      },
    ],
  },
];

const visible = (role: Role, hidden: string[]) =>
  SECTIONS.map((s) => ({ ...s, tabs: s.tabs.filter((t) => canSee(t.href, role, hidden)) })).filter((s) => s.tabs.length);

const isUnder = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

/** The tab (and its section) whose href or `also` is the longest prefix of the URL. */
function useCurrent(role: Role, hidden: string[]) {
  const path = usePathname();
  const sections = visible(role, hidden);
  let current: { section: Section; tab: Tab } | undefined;
  let best = -1;
  for (const section of sections)
    for (const tab of section.tabs)
      for (const href of [tab.href, ...(tab.also ?? [])])
        if (isUnder(path, href) && href.length > best) {
          best = href.length;
          current = { section, tab };
        }
  return { sections, current };
}

function Icon({ d, small }: { d: string; small?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={small ? "h-5 w-5 shrink-0" : "h-6 w-6"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const PLUS = "M12 5v14M5 12h14";
/** Quick actions behind the central "+": the daily tasks, one tap from anywhere. Each shows if its screen does. */
const QUICK = [
  { href: "/pedidos/nuevo", label: "Nuevo pedido", hint: "Un cliente llamó" },
  { href: "/deudores", label: "Registrar cobro", hint: "Pagó en la oficina" },
  { href: "/compras/nueva", label: "Lista de pedido", hint: "Al proveedor o para ir a comprar" },
  { href: "/recepciones/nueva", label: "Ingreso de mercadería", hint: "Llegó o leer factura" },
  { href: "/productos/catalogo", label: "Catálogo para clientes", hint: "Imágenes para WhatsApp" },
];

/** Mobile only: floating bar at the bottom (with "+" when some quick action is visible). Desktop uses SideNav. */
export function SectionNav({ role, hidden = [], badges = {} }: { role: Role; hidden?: string[]; badges?: NavBadges }) {
  const { sections, current } = useCurrent(role, hidden);
  const [open, setOpen] = useState(false);
  const quick = QUICK.filter((q) => canSee(q.href, role, hidden));
  const plus = quick.length > 0;
  const item = (s: Section) => (
    <Link
      key={s.label}
      href={s.tabs[0].href}
      className={`flex flex-col items-center gap-0.5 py-1 text-[11px] ${s === current?.section ? "font-semibold text-primary" : "font-medium text-muted"}`}
    >
      <span className="relative">
        <Icon d={s.icon} />
        {/* Red dot: something pending in this section (counts are in the tabs and on desktop). */}
        {s.tabs.some((t) => badges[t.href]?.n) && (
          <span className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-red-600">
            <span className="sr-only">Tiene pendientes</span>
          </span>
        )}
      </span>
      {s.label}
    </Link>
  );
  const half = Math.ceil(sections.length / 2);
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-slate-900/35 md:hidden print:hidden">
          <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="flex-1" />
          <div className="flex flex-col gap-2 rounded-t-3xl bg-surface px-4 pt-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
            <div className="mb-2 h-1 w-10 self-center rounded-full bg-slate-300" aria-hidden />
            {quick.map((q, i) => (
              <Link
                key={q.href}
                href={q.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 font-semibold ${i === 0 ? "bg-teal-50" : "bg-slate-50"}`}
              >
                {q.label}
                <span className="ml-auto text-xs font-normal text-muted">{q.hint}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 rounded-[22px] border border-border bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.10)] md:hidden print:hidden"
      >
        <div
          className="mx-auto grid h-[68px] max-w-3xl items-center"
          style={{ gridTemplateColumns: `repeat(${sections.length + (plus ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {plus ? sections.slice(0, half).map(item) : sections.map(item)}
          {plus && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Acciones rápidas"
              className="flex h-[52px] w-[52px] items-center justify-center justify-self-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(15,118,110,0.35)] active:scale-95"
            >
              <Icon d={PLUS} />
            </button>
          )}
          {plus && sections.slice(half).map(item)}
        </div>
      </nav>
    </>
  );
}

/** Tabs of the current section as a segmented switch (hidden when the section has only one page). */
export function SectionTabs({ role, hidden = [], badges = {} }: { role: Role; hidden?: string[]; badges?: NavBadges }) {
  const { current } = useCurrent(role, hidden);
  if (!current || current.section.tabs.length < 2) return null;
  return (
    <nav className="mx-auto w-full max-w-3xl px-4 pt-3 md:hidden print:hidden">
      <div className="grid rounded-xl bg-slate-200/70 p-1" style={{ gridTemplateColumns: `repeat(${current.section.tabs.length}, minmax(0, 1fr))` }}>
        {current.section.tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex h-9 items-center justify-center rounded-[9px] text-sm ${t === current.tab ? "bg-surface font-semibold shadow-sm" : "font-medium text-muted"}`}
          >
            {t.short ?? t.label}
            {!!badges[t.href]?.n && (
              <span className={`cifra ml-1.5 min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 ${BADGE[badges[t.href]!.tone]}`}>
                {badges[t.href]!.n > 99 ? "99+" : badges[t.href]!.n}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * Desktop (md+): fixed left menu with every section and its tabs, and `footer` (who is signed in + Salir, rendered by the server layout).
 */
/** Count shown next to a menu item (only when > 0), and its color: "alert" for things to act on, "info" otherwise. */
export type NavBadges = Partial<Record<string, { n: number; tone: "alert" | "warn" | "info" }>>;
const BADGE = { alert: "bg-red-700 text-white", warn: "bg-amber-600 text-white", info: "bg-teal-700 text-white" } as const;

export function SideNav({
  role,
  hidden = [],
  brand,
  footer,
  badges = {},
}: {
  role: Role;
  hidden?: string[];
  brand: string;
  footer: React.ReactNode;
  badges?: NavBadges;
}) {
  const { sections, current } = useCurrent(role, hidden);
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface px-3.5 py-5 md:flex print:hidden">
      <Link href="/" aria-label={`${brand} · Inicio`} className="px-2">
        <Logo size={40} />
      </Link>
      {/* Section titles are small grey labels; the screens under them are items with an icon (like NicFarma). */}
      <nav aria-label="Secciones" className="flex flex-col gap-5">
        {sections.map((s) => {
          const items = s.tabs.length === 1 && s.tabs[0].href === "/" ? [{ ...s.tabs[0], icon: s.icon }] : s.tabs;
          return (
            <div key={s.label} className="flex flex-col gap-0.5">
              {items[0].href !== "/" && (
                <span className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-slate-400 uppercase">{s.label}</span>
              )}
              {items.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] ${t === current?.tab || (t.href === "/" && s === current?.section) ? "bg-teal-50 font-semibold text-teal-800" : "font-medium text-slate-700 hover:bg-slate-100"}`}
                >
                  {t.icon && <Icon d={t.icon} small />}
                  <span className="flex-1">{t.label}</span>
                  {!!badges[t.href]?.n && (
                    <span className={`cifra min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs ${BADGE[badges[t.href]!.tone]}`}>
                      {badges[t.href]!.n > 99 ? "99+" : badges[t.href]!.n}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto">{footer}</div>
    </aside>
  );
}
