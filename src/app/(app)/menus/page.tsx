import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { Avatar } from "@/components/ui/avatar";
import { MenuVisibilityForm, listUsersWithSessions } from "@/modules/users";

export default async function MenusPage({ searchParams }: PageProps<"/menus">) {
  await requireAdmin();
  const sp = await searchParams;
  const users = await listUsersWithSessions(new Date());
  const selected = users.find((u) => u.id === sp.usuario);
  return (
    <section className="flex flex-col gap-5">
      <BackLink href="/catalogo" label="Ajustes" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Menús</h1>
      <p className="-mt-3 text-sm text-muted">Elige un usuario y marca las pantallas que ve. El cambio vale desde su siguiente pantalla.</p>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ul className="lista">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/menus?usuario=${u.id}`}
                className={`fila flex items-center gap-3 ${u.id === selected?.id ? "bg-teal-50" : ""} ${u.active ? "" : "opacity-60"}`}
              >
                <Avatar name={u.name} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block text-sm text-muted">
                    {u.hiddenMenus.length
                      ? `${u.hiddenMenus.length} pantalla${u.hiddenMenus.length === 1 ? "" : "s"} oculta${u.hiddenMenus.length === 1 ? "" : "s"}`
                      : "Ve todo"}
                  </span>
                </span>
                <span aria-hidden className="text-lg text-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="lg:sticky lg:top-6">
          {selected ? (
            <MenuVisibilityForm
              key={selected.id}
              user={{ id: selected.id, name: selected.name, role: selected.role, isAdmin: selected.isAdmin, hiddenMenus: selected.hiddenMenus }}
            />
          ) : (
            <p className="tarjeta text-sm text-muted">Elige un usuario de la lista.</p>
          )}
        </div>
      </div>
    </section>
  );
}
