import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { NewUserForm, UserList, listUsersWithSessions } from "@/modules/users";

export default async function UsersPage() {
  const me = await requireUser("DUENO");
  const now = new Date();
  const users = await listUsersWithSessions(now);
  return (
    <section className="flex flex-col gap-5">
      <BackLink href="/catalogo" label="Ajustes" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Usuarios</h1>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <UserList users={users} currentUserId={me.id} now={now} />
        </div>
        <div className="lg:sticky lg:top-6">
          <NewUserForm />
        </div>
      </div>
    </section>
  );
}
