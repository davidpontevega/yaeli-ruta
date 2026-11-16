import { requireUser } from "@/server/auth";
import { AppHeader } from "@/components/app-header";
import { SectionTabs } from "@/components/app-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <AppHeader user={user} />
      <SectionTabs role={user.role} />
      {/* Bottom padding leaves room for the fixed bottom bar on mobile. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-5">{children}</main>
    </>
  );
}
