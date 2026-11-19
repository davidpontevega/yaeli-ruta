import type { Role } from "@/server/db/schema";

// Menus a user can see. Pure: used by the navs (client), `requireUser` (server) and the /menus page.
// Order = order of "first allowed screen". `owner` = DUENO only.
export const MENUS = [
  { key: "inicio", label: "Inicio", group: "Inicio", href: "/", prefixes: ["/"] },
  { key: "pedidos", label: "Pedidos", group: "Ventas", owner: true, href: "/pedidos", prefixes: ["/pedidos"] },
  {
    key: "clientes",
    label: "Clientes, cobros y rutas",
    group: "Ventas",
    owner: true,
    href: "/clientes",
    prefixes: ["/clientes", "/deudores", "/rutas"],
  },
  { key: "stock", label: "Stock", group: "Almacén", href: "/stock", prefixes: ["/stock"] },
  { key: "vencimientos", label: "Por vencer", group: "Almacén", href: "/vencimientos", prefixes: ["/vencimientos"] },
  { key: "compras", label: "Lista de pedido y proveedores", group: "Almacén", owner: true, href: "/compras", prefixes: ["/compras", "/proveedores"] },
  { key: "recepciones", label: "Ingreso de mercadería", group: "Almacén", owner: true, href: "/recepciones/nueva", prefixes: ["/recepciones"] },
  { key: "productos", label: "Productos y precios", group: "Más", href: "/productos", prefixes: ["/productos", "/precios"] },
  {
    key: "catalogo",
    label: "Catálogo para clientes",
    group: "Más",
    owner: true,
    href: "/productos/catalogo",
    prefixes: ["/productos/catalogo", "/productos/fotos"],
  },
  { key: "ajustes", label: "Ajustes", group: "Más", owner: true, href: "/catalogo", prefixes: ["/catalogo"] },
  { key: "usuarios", label: "Usuarios y PIN", group: "Más", owner: true, href: "/usuarios", prefixes: ["/usuarios"] },
] as const satisfies readonly { key: string; label: string; group: string; owner?: boolean; href: string; prefixes: readonly string[] }[];

export type MenuKey = (typeof MENUS)[number]["key"];
type Menu = (typeof MENUS)[number];

const isUnder = (path: string, prefix: string) => (prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`));
const roleSees = (m: Menu, role: Role) => !("owner" in m && m.owner) || role === "DUENO";

/** Menu that owns a URL (longest prefix wins), or null for screens that are never hidden (/menus, /api, …). */
export function menuKeyFor(url: string): MenuKey | null {
  const path = url.split(/[?#]/)[0];
  let key: MenuKey | null = null;
  let best = -1;
  for (const m of MENUS)
    for (const p of m.prefixes)
      if (isUnder(path, p) && p.length > best) {
        best = p.length;
        key = m.key;
      }
  return key;
}

/** Whether a user with this role and hidden list sees the screen at `path`. */
export function canSee(path: string, role: Role, hidden: readonly string[]): boolean {
  const key = menuKeyFor(path);
  if (!key) return true;
  const m = MENUS.find((x) => x.key === key)!;
  return roleSees(m, role) && !hidden.includes(key);
}

/** Href of the first screen this user sees; "/login" if none. */
export function firstAllowed(role: Role, hidden: readonly string[]): string {
  return MENUS.find((m) => roleSees(m, role) && !hidden.includes(m.key))?.href ?? "/login";
}

/** Menus this role can see (the checks shown in /menus). */
export const menusFor = (role: Role) => MENUS.filter((m) => roleSees(m, role));

/** Cleans a hidden list from a form: drops unknown or role-invisible keys and duplicates; an admin keeps "ajustes" (way to /menus). */
export function sanitizeHidden(
  keys: readonly string[],
  role: Role,
  isAdmin: boolean,
): { ok: true; hidden: MenuKey[] } | { ok: false; error: string } {
  const allowed = menusFor(role).map((m) => m.key as MenuKey);
  const hidden = allowed.filter((k) => keys.includes(k) && !(isAdmin && k === "ajustes"));
  if (hidden.length >= allowed.length) return { ok: false, error: "Deja al menos una pantalla" };
  return { ok: true, hidden };
}
