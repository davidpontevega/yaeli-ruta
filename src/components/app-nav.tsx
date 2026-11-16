"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/server/db/schema";

type Tab = { href: string; label: string; ownerOnly?: boolean };
type Section = { label: string; icon: string; tabs: Tab[] };

// 4 sections; each page belongs to the section whose tab is the longest prefix of the URL.
const SECTIONS: Section[] = [
  { label: "Inicio", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z", tabs: [{ href: "/", label: "Inicio" }] },
  {
    label: "Ventas",
    icon: "M3 3h2l2.5 12h11L21 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    tabs: [
      { href: "/pedidos", label: "Pedidos", ownerOnly: true },
      { href: "/clientes", label: "Clientes", ownerOnly: true },
      { href: "/deudores", label: "Deudores", ownerOnly: true },
      { href: "/rutas", label: "Rutas", ownerOnly: true },
    ],
  },
  {
    label: "Almacén",
    icon: "M3 8l9-5 9 5v12H3zM7 20v-8h10v8M7 15h10",
    tabs: [
      { href: "/stock", label: "Stock" },
      { href: "/vencimientos", label: "Vencimientos" },
      { href: "/recepciones/nueva", label: "Recibir", ownerOnly: true },
      { href: "/proveedores", label: "Proveedores", ownerOnly: true },
    ],
  },
  {
    label: "Más",
    icon: "M4 6h16M4 12h16M4 18h16",
    tabs: [
      { href: "/productos", label: "Productos" },
      { href: "/catalogo", label: "Catálogo", ownerOnly: true },
      { href: "/precios", label: "Precios", ownerOnly: true },
      { href: "/usuarios", label: "Usuarios", ownerOnly: true },
    ],
  },
];

const visible = (role: Role) =>
  SECTIONS.map((s) => ({ ...s, tabs: s.tabs.filter((t) => !t.ownerOnly || role === "DUENO") })).filter((s) => s.tabs.length);

const isUnder = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

function useCurrent(role: Role) {
  const path = usePathname();
  const sections = visible(role);
  let current: Section | undefined;
  let best = -1;
  for (const s of sections)
    for (const t of s.tabs)
      if (isUnder(path, t.href) && t.href.length > best) {
        best = t.href.length;
        current = s;
      }
  return { path, sections, current };
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

/** Mobile: fixed bar at the bottom. Desktop: the same sections inline in the header. */
export function SectionNav({ role }: { role: Role }) {
  const { sections, current } = useCurrent(role);
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-3xl">
          {sections.map((s) => (
            <Link
              key={s.label}
              href={s.tabs[0].href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${s === current ? "text-primary" : "text-muted"}`}
            >
              <Icon d={s.icon} />
              {s.label}
            </Link>
          ))}
        </div>
      </nav>
      <nav className="hidden gap-1 text-sm md:flex">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.tabs[0].href}
            className={`rounded-lg px-3 py-1.5 font-medium ${s === current ? "bg-slate-100 text-primary" : "hover:bg-slate-100"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Tabs of the current section (hidden when the section has only one page). */
export function SectionTabs({ role }: { role: Role }) {
  const { path, current } = useCurrent(role);
  if (!current || current.tabs.length < 2) return null;
  return (
    <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pt-3 text-sm">
      {current.tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`shrink-0 rounded-full px-3 py-1.5 font-medium ${isUnder(path, t.href) ? "bg-primary text-primary-foreground" : "bg-slate-100"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
