"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { signIn } from "../actions";

type User = { id: string; name: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const key =
  "flex h-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-foreground transition active:scale-95 hover:bg-slate-200";

export function LoginForm({ users }: { users: User[] }) {
  const [selected, setSelected] = useState<User | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState("");
  const [state, action, pending] = useActionState(signIn, undefined);
  const form = useRef<HTMLFormElement>(null);

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  // On a PC the PIN can be typed: digits, Backspace, Enter.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") {
        const typed = (form.current?.elements.namedItem("pin") as HTMLInputElement | null)?.value ?? "";
        if (typed.length >= 4) form.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (!selected) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">Iniciar sesión</h2>
          <p className="text-sm text-muted">¿Quién eres?</p>
        </div>
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected(u)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
              >
                <Avatar name={u.name} />
                <span className="flex-1 text-base font-semibold">{u.name}</span>
                <span aria-hidden className="text-lg text-muted">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <form
      ref={form}
      // FormData already carries the PIN; clear it so the user can retry if it fails.
      action={(f) => (setPin(""), action(f))}
      className="flex flex-col items-center gap-5"
    >
      <input type="hidden" name="userId" value={selected.id} />
      <input type="hidden" name="pin" value={pin} />
      <div className="flex w-full items-center gap-3">
        <Avatar name={selected.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">Hola, {selected.name}</p>
          <p className="text-sm text-muted">Escribe tu PIN</p>
        </div>
        {users.length > 1 && (
          <button type="button" onClick={() => (setSelected(null), setPin(""))} className="shrink-0 text-sm font-medium text-primary">
            Cambiar
          </button>
        )}
      </div>

      <div className="flex h-6 gap-3" aria-label={`PIN: ${pin.length} dígitos`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 transition ${i < pin.length ? "scale-110 border-primary bg-primary" : "border-slate-300"}`}
          />
        ))}
      </div>

      <p role="alert" className="-my-2 min-h-5 text-center text-sm text-red-600">
        {state?.error}
      </p>

      <div className="grid w-full grid-cols-3 gap-2.5">
        {KEYS.map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key}>
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className={`${key} text-xl text-muted`} aria-label="Borrar">
          ⌫
        </button>
        <button type="button" onClick={() => press("0")} className={key}>
          0
        </button>
        <button type="submit" disabled={pin.length < 4 || pending} className="btn-primario h-16 rounded-2xl text-lg">
          {pending ? "…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
