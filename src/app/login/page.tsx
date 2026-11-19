import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/ui/logo";
import { FirstOwnerForm, LoginForm, listActiveUsers } from "@/modules/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await listActiveUsers();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo size={64} />
        <h1 className="text-sm font-medium text-muted">{BRAND.name} · stock y reparto</h1>
      </header>
      {users.length ? <LoginForm users={users} /> : <FirstOwnerForm />}
    </main>
  );
}
