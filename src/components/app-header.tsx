import Link from "next/link";
import type { CurrentUser } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { signOut } from "@/modules/auth";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/stock", label: "Stock" },
  { href: "/vencimientos", label: "Vencimientos" },
  { href: "/recepciones/nueva", label: "Recibir", ownerOnly: true },
  { href: "/catalogo", label: "Catálogo", ownerOnly: true },
  { href: "/usuarios", label: "Usuarios", ownerOnly: true },
];

export function AppHeader({ user }: { user: CurrentUser }) {
  const links = LINKS.filter((l) => !l.ownerOnly || user.role === "DUENO");
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          {BRAND.name}
        </Link>
        <form action={signOut} className="flex items-center gap-3 text-sm">
          <span className="text-muted">{user.name}</span>
          <button className="btn-secundario h-9 text-sm">Salir</button>
        </form>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 font-medium hover:bg-slate-100">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
