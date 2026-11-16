import { requireUser } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { signOut } from "@/modules/auth";
import { AppHeader } from "@/components/app-header";
import { SectionTabs, SideNav, type NavBadges } from "@/components/app-nav";
import { getAlertCounts } from "@/modules/inventory";
import { countDebtors } from "@/modules/accounts";
import { countPendingDue } from "@/modules/orders";
import { listPriceReview } from "@/modules/catalog";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const owner = user.role === "DUENO";
  const [alerts, debtors, pending, review] = await Promise.all([
    getAlertCounts(),
    owner ? countDebtors() : 0,
    owner ? countPendingDue() : 0,
    owner ? listPriceReview() : [],
  ]);
  const badges: NavBadges = {
    "/pedidos": { n: pending, tone: "info" },
    "/clientes": { n: debtors, tone: "alert" },
    "/stock": { n: alerts.lowStock, tone: "warn" },
    "/vencimientos": { n: alerts.expired + alerts.within30, tone: alerts.expired ? "alert" : "warn" },
    "/productos": { n: review.length, tone: "info" },
  };
  return (
    <div className="flex min-h-full flex-1">
      <SideNav
        role={user.role}
        brand={BRAND.name}
        badges={badges}
        footer={
          <form action={signOut} className="flex items-center gap-2 border-t border-border px-1.5 pt-4 text-sm">
            <span className="min-w-0 flex-1 truncate text-muted">{user.name}</span>
            <button className="btn-secundario h-9 text-sm">Salir</button>
          </form>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} badges={badges} />
        <SectionTabs role={user.role} badges={badges} />
        {/* Bottom padding leaves room for the floating bottom bar on phones. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 md:max-w-6xl py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
