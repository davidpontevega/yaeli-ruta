import { requireUser } from "@/server/auth";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</main>
    </>
  );
}
