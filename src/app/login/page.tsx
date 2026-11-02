import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { FirstOwnerForm, LoginForm, listActiveUsers } from "@/modules/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await listActiveUsers();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">{BRAND.name}</h1>
        <p className="text-muted">{BRAND.company}</p>
      </header>
      {users.length ? <LoginForm users={users} /> : <FirstOwnerForm />}
    </main>
  );
}
