"use client";

import { useActionState, useState } from "react";
import { signIn } from "../actions";

type User = { id: string; name: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function LoginForm({ users }: { users: User[] }) {
  const [selected, setSelected] = useState<User | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState("");
  const [state, action, pending] = useActionState(signIn, undefined);

  if (!selected) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-center text-lg font-medium">¿Quién eres?</h2>
        {users.map((u) => (
          <button key={u.id} type="button" onClick={() => setSelected(u)} className="btn-secundario h-14 text-lg">
            {u.name}
          </button>
        ))}
      </section>
    );
  }

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  return (
    <form
      // FormData already carries the PIN; clear it so the user can retry if it fails.
      action={(f) => (setPin(""), action(f))}
      className="flex flex-col items-center gap-5"
    >
      <input type="hidden" name="userId" value={selected.id} />
      <input type="hidden" name="pin" value={pin} />
      <div className="text-center">
        <p className="text-lg font-medium">Hola, {selected.name}</p>
        {users.length > 1 && (
          <button type="button" onClick={() => (setSelected(null), setPin(""))} className="text-sm text-primary underline">
            No soy yo
          </button>
        )}
      </div>

      <div className="flex h-6 gap-3" aria-label={`PIN: ${pin.length} dígitos`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`size-4 rounded-full border-2 border-primary ${i < pin.length ? "bg-primary" : ""}`} />
        ))}
      </div>

      <p role="alert" className="min-h-5 text-center text-sm text-red-600">
        {state?.error}
      </p>

      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="btn-secundario h-16 text-2xl">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className="btn-secundario h-16" aria-label="Borrar">
          ⌫
        </button>
        <button type="button" onClick={() => press("0")} className="btn-secundario h-16 text-2xl">
          0
        </button>
        <button type="submit" disabled={pin.length < 4 || pending} className="btn-primario h-16 text-lg">
          {pending ? "…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
