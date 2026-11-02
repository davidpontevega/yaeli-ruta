import { requireUser } from "@/server/auth";
import { NewUserForm, UserList, listUsersWithSessions } from "@/modules/users";

export default async function UsersPage() {
  const me = await requireUser("DUENO");
  const now = new Date();
  const users = await listUsersWithSessions(now);
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <UserList users={users} currentUserId={me.id} now={now} />
      <NewUserForm />
    </section>
  );
}
