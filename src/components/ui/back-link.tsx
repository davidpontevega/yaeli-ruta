"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "yr_ruta";
/** Form screens: going "back" to them after saving would reopen an empty or stale form, so they are skipped. */
const FORM = /\/(nuevo|nueva|editar|entregar|inicial)$/;
const NAMES: Record<string, string> = {
  "": "Inicio",
  pedidos: "Pedidos",
  reparto: "Reparto",
  clientes: "Clientes",
  deudores: "Deudores",
  rutas: "Rutas",
  stock: "Stock",
  vencimientos: "Por vencer",
  compras: "Listas de pedido",
  recepciones: "Ingreso",
  proveedores: "Proveedores",
  productos: "Productos",
  precios: "Precios",
  catalogo: "Ajustes",
  usuarios: "Usuarios",
  menus: "Menús",
};

const read = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};
const pathOf = (url: string) => url.split("?")[0];

/** Readable name of an in-app URL, or null when unknown. */
function nameOf(url: string): string | null {
  const [path, query = ""] = url.split("?");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "stock" && /(^|&)falta=1/.test(query)) return "Stock bajo";
  if (parts[0] === "productos" && parts[2] === "movimientos") return "Movimientos";
  if (parts[0] === "compras" && parts[1]) return "la lista";
  if (parts[0] === "pedidos" && parts[1]) return "el pedido";
  if (parts[0] === "reparto" && parts[1]) return "la hoja";
  return NAMES[parts[0] ?? ""] ?? null;
}

/**
 * Mounted once in the app layout: keeps the trail of screens visited in this tab (sessionStorage). Revisiting a screen
 * already in the trail cuts it there, like a breadcrumb; a filter change on the same screen replaces its entry.
 */
export function NavTrail() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    const trail = read();
    const at = trail.findIndex((u) => pathOf(u) === pathname);
    const next = at >= 0 ? [...trail.slice(0, at), url] : [...trail, url].slice(-30);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: BackLink falls back to its fixed parent */
    }
  }, [pathname, search]);
  return null;
}

/**
 * "‹ Volver a X" at the top of a screen reached from a button. Goes to the screen you came from (Stock → Movimientos →
 * back to Stock); after a reload or a direct link, to the fixed parent `href`.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const [target, setTarget] = useState({ href, label });
  useEffect(() => {
    const trail = read();
    const here = trail.findIndex((u) => pathOf(u) === pathname);
    const prev = trail
      .slice(0, here >= 0 ? here : trail.length)
      .reverse()
      .find((u) => pathOf(u) !== pathname && !FORM.test(pathOf(u)) && nameOf(u));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage only exists in the browser
    if (prev) setTarget({ href: prev, label: nameOf(prev)! });
  }, [pathname, href]);
  return (
    <Link
      href={target.href}
      className="-mb-2 inline-flex h-9 items-center gap-1 self-start rounded-full pr-3 pl-1.5 text-sm font-medium text-muted transition hover:bg-slate-200/60 hover:text-foreground print:hidden"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Volver a {target.label}
    </Link>
  );
}
