import { Avatar } from "@/components/ui/avatar";
import type { UserRow } from "../queries";
import { revokeSessions, setUserActive } from "../actions";
import { ChangePinForm } from "./change-pin-form";

const ROLE_LABEL = { DUENO: "Dueño", REPARTIDOR: "Repartidor" } as const;

export function UserList({ users, currentUserId, now }: { users: UserRow[]; currentUserId: string; now: Date }) {
  return (
    <ul className="lista">
      {users.map((u) => (
        <li key={u.id} className={`fila flex flex-col gap-3 ${u.active ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-3">
            <Avatar name={u.name} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {u.name}{" "}
                <span className={`chip ml-1 ${u.role === "DUENO" ? "bg-teal-50 text-teal-800" : "bg-sky-50 text-sky-800"}`}>
                  {ROLE_LABEL[u.role]}
                </span>
                {u.isAdmin && <span className="chip ml-1 bg-violet-50 text-violet-800">Admin</span>}
              </p>
              <p className="text-sm text-muted">
                {u.sessions} {u.sessions === 1 ? "celular conectado" : "celulares conectados"}
                {!u.active && " · Desactivado"}
                {u.lockedUntil && u.lockedUntil > now && " · Bloqueado por intentos"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChangePinForm userId={u.id} />
            {u.sessions > 0 && (
              <form action={revokeSessions}>
                <input type="hidden" name="userId" value={u.id} />
                <button className="btn-secundario h-10 text-sm">Cerrar sesiones</button>
              </form>
            )}
            {u.id !== currentUserId && (
              <form action={setUserActive}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="active" value={String(!u.active)} />
                <button className="btn-secundario h-10 text-sm">{u.active ? "Desactivar" : "Activar"}</button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
