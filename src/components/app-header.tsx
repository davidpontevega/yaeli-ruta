import Link from "next/link";
import type { CurrentUser } from "@/server/auth";
import { LogoMark } from "@/components/ui/logo";
import { SignOutButton } from "@/modules/auth";
import { SectionNav, type NavBadges } from "./app-nav";

export function AppHeader({ user, badges }: { user: CurrentUser; badges?: NavBadges }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface pt-[env(safe-area-inset-top)] md:hidden print:hidden">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Inicio" className="shrink-0">
          <LogoMark size={36} label="Distribuidora Yaeli" />
        </Link>
        <SectionNav role={user.role} hidden={user.hiddenMenus} badges={badges} />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{user.name}</span>
          <SignOutButton userId={user.id} className="btn-secundario h-9 text-sm" />
        </div>
      </div>
    </header>
  );
}
