import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { LogoMark } from "@/components/ui/logo";
import { FirstOwnerForm, LoginForm, listActiveUsers } from "@/modules/auth";

const HELP = "Entras con tu usuario y PIN. Si olvidaste tu PIN, pídele al administrador que te lo cambie.";

// Like NicFarma's sign-in: on wide screens the brand on the left and the form on the right; on a phone, brand on top.
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await listActiveUsers();
  const [first, second = ""] = BRAND.name.split(" ");

  return (
    <div className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_26rem_at_0%_0%,rgb(15_118_110/0.10),transparent_70%),radial-gradient(40rem_28rem_at_100%_100%,rgb(251_191_36/0.10),transparent_70%)]"
      />
      <div className="relative grid w-full max-w-5xl items-center gap-8 md:grid-cols-2 lg:gap-20">
        <aside className="flex flex-col items-center gap-4 text-center md:items-end md:text-right">
          <span className="flex size-24 items-center justify-center rounded-3xl bg-surface shadow-lg ring-1 ring-border md:size-28">
            <LogoMark size={76} label={BRAND.company} />
          </span>
          <div>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">
              <span className="text-[#134E4A]">{first}</span> <span className="text-primary">{second}</span>
            </h1>
            <p className="mt-2 text-lg font-medium text-muted md:text-xl">{BRAND.company}</p>
            <p className="mt-1 text-sm text-muted">Stock, pedidos y reparto en un solo lugar</p>
          </div>
          <p className="mt-4 hidden max-w-xs text-xs text-muted md:block">{HELP}</p>
          <p className="hidden text-xs text-muted md:block">
            © {new Date().getFullYear()} {BRAND.company}
          </p>
        </aside>

        <main className="flex flex-col items-center gap-4 md:items-start">
          <div className="tarjeta w-full max-w-sm p-6 shadow-lg">{users.length ? <LoginForm users={users} /> : <FirstOwnerForm />}</div>
          <p className="max-w-xs text-center text-xs text-muted md:hidden">{HELP}</p>
        </main>
      </div>
    </div>
  );
}
