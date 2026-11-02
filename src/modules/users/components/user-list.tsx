import type { UserRow } from "../queries";
import { revokeSessions, setUserActive } from "../actions";
import { ChangePinForm } from "./change-pin-form";

const ROLE_LABEL = { DUENO: "Dueño", REPARTIDOR: "Repartidor" } as const;

export function UserList({ users, currentUserId, now }: { users: UserRow[]; currentUserId: string; now: Date }) {
  return (
    <ul className="flex flex-col gap-3">
      {users.map((u) => (
        <li key={u.id} className={`tarjeta flex flex-col gap-3 ${u.active ? "" : "opacity-60"}`}>
          <div>
            <p className="font-semibold">{u.name}</p>
            <p className="text-sm text-muted">
              {ROLE_LABEL[u.role]} · {u.sessions} {u.sessions === 1 ? "celular conectado" : "celulares conectados"}
              {!u.active && " · Desactivado"}
              {u.lockedUntil && u.lockedUntil > now && " · Bloqueado por intentos"}
            </p>
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
