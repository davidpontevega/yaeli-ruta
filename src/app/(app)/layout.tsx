import Link from "next/link";
import { requerirUsuario } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { salir } from "../login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const u = await requerirUsuario();
  const enlaces = [
    { href: "/", texto: "Inicio" },
    ...(u.rol === "DUENO" ? [{ href: "/usuarios", texto: "Usuarios" }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/" className="text-lg font-bold text-primary">
            {BRAND.nombre}
          </Link>
          <form action={salir} className="flex items-center gap-3 text-sm">
            <span className="text-muted">{u.nombre}</span>
            <button className="btn-secundario h-9 text-sm">Salir</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} className="rounded-lg px-3 py-1.5 font-medium hover:bg-slate-100">
              {e.texto}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  );
}
