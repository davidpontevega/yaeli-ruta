"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/server/db/schema";

/** `also`: pages reached from inside this tab (buttons), so the tab stays highlighted there. */
type Tab = { href: string; label: string; ownerOnly?: boolean; also?: string[] };
type Section = { label: string; icon: string; tabs: Tab[] };

// 4 sections × at most 2 tabs. Less frequent screens live behind buttons inside their tab.
const SECTIONS: Section[] = [
  { label: "Inicio", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z", tabs: [{ href: "/", label: "Inicio" }] },
  {
    label: "Ventas",
    icon: "M3 3h2l2.5 12h11L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    tabs: [
      { href: "/pedidos", label: "Pedidos", ownerOnly: true },
      { href: "/clientes", label: "Clientes", ownerOnly: true, also: ["/deudores", "/rutas"] },
    ],
  },
  {
    label: "Almacén",
    icon: "M3 8l9-5 9 5v12H3zM7 20v-8h10v8M7 15h10",
    tabs: [
      { href: "/stock", label: "Stock", also: ["/vencimientos"] },
      { href: "/compras", label: "Compras", ownerOnly: true, also: ["/recepciones", "/proveedores"] },
    ],
  },
  {
    label: "Más",
    icon: "M4 6h16M4 12h16M4 18h16",
    tabs: [
      { href: "/productos", label: "Productos", also: ["/precios"] },
      { href: "/catalogo", label: "Ajustes", ownerOnly: true, also: ["/usuarios"] },
    ],
  },
];

const visible = (role: Role) =>
  SECTIONS.map((s) => ({ ...s, tabs: s.tabs.filter((t) => !t.ownerOnly || role === "DUENO") })).filter((s) => s.tabs.length);

const isUnder = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

/** The tab (and its section) whose href or `also` is the longest prefix of the URL. */
function useCurrent(role: Role) {
  const path = usePathname();
  const sections = visible(role);
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

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
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
/** Quick actions behind the central "+" (owner only): the daily tasks, one tap from anywhere. */
const QUICK = [
  { href: "/pedidos/nuevo", label: "Nuevo pedido", hint: "Un cliente llamó" },
  { href: "/deudores", label: "Registrar cobro", hint: "Pagó en la oficina" },
  { href: "/compras/nueva", label: "Nueva compra", hint: "Lista para el proveedor" },
  { href: "/recepciones/nueva", label: "Recibir mercadería", hint: "Llegó o leer factura" },
];

/** Mobile: floating bar at the bottom (with "+" for the owner). Desktop: the same sections inline in the header. */
export function SectionNav({ role }: { role: Role }) {
  const { sections, current } = useCurrent(role);
  const [open, setOpen] = useState(false);
  const owner = role === "DUENO";
  const item = (s: Section) => (
    <Link
      key={s.label}
      href={s.tabs[0].href}
      className={`flex flex-col items-center gap-0.5 py-1 text-[11px] ${s === current?.section ? "font-semibold text-primary" : "font-medium text-muted"}`}
    >
      <Icon d={s.icon} />
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
            {QUICK.map((q, i) => (
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
          style={{ gridTemplateColumns: `repeat(${sections.length + (owner ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {owner ? sections.slice(0, half).map(item) : sections.map(item)}
          {owner && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Acciones rápidas"
              className="flex h-[52px] w-[52px] items-center justify-center justify-self-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(15,118,110,0.35)] active:scale-95"
            >
              <Icon d={PLUS} />
            </button>
          )}
          {owner && sections.slice(half).map(item)}
        </div>
      </nav>
      <nav className="hidden gap-1 text-sm md:flex">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.tabs[0].href}
            className={`rounded-lg px-3 py-1.5 font-medium ${s === current?.section ? "bg-teal-50 text-primary" : "hover:bg-slate-100"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Tabs of the current section as a segmented switch (hidden when the section has only one page). */
export function SectionTabs({ role }: { role: Role }) {
  const { current } = useCurrent(role);
  if (!current || current.section.tabs.length < 2) return null;
  return (
    <nav className="mx-auto w-full max-w-3xl px-4 pt-3 print:hidden">
      <div className="grid rounded-xl bg-slate-200/70 p-1" style={{ gridTemplateColumns: `repeat(${current.section.tabs.length}, minmax(0, 1fr))` }}>
        {current.section.tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex h-9 items-center justify-center rounded-[9px] text-sm ${t === current.tab ? "bg-surface font-semibold shadow-sm" : "font-medium text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
