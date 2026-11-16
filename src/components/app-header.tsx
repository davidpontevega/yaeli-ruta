import Link from "next/link";
import type { CurrentUser } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { signOut } from "@/modules/auth";
import { SectionNav } from "./app-nav";

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          {BRAND.name}
        </Link>
        <SectionNav role={user.role} />
        <form action={signOut} className="flex items-center gap-3 text-sm">
          <span className="text-muted">{user.name}</span>
          <button className="btn-secundario h-9 text-sm">Salir</button>
        </form>
      </div>
    </header>
  );
}
