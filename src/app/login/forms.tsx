"use client";

import { useActionState, useState } from "react";
import { crearDueno, entrar } from "./actions";

type Usuario = { id: string; nombre: string };

export function LoginForm({ usuarios }: { usuarios: Usuario[] }) {
  const [elegido, setElegido] = useState<Usuario | null>(usuarios.length === 1 ? usuarios[0] : null);
  const [pin, setPin] = useState("");
  const [estado, accion, enviando] = useActionState(entrar, undefined);

  if (!elegido) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-center text-lg font-medium">¿Quién eres?</h2>
        {usuarios.map((u) => (
          <button key={u.id} type="button" onClick={() => setElegido(u)} className="btn-secundario h-14 text-lg">
            {u.nombre}
          </button>
        ))}
      </section>
    );
  }

  const tecla = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  return (
    <form
      // El FormData ya lleva el PIN; se limpia para reintentar si falla.
      action={(f) => (setPin(""), accion(f))}
      className="flex flex-col items-center gap-5"
    >
      <input type="hidden" name="usuarioId" value={elegido.id} />
      <input type="hidden" name="pin" value={pin} />
      <div className="text-center">
        <p className="text-lg font-medium">Hola, {elegido.nombre}</p>
        {usuarios.length > 1 && (
          <button type="button" onClick={() => (setElegido(null), setPin(""))} className="text-sm text-primary underline">
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
        {estado?.error}
      </p>

      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => tecla(d)} className="btn-secundario h-16 text-2xl">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className="btn-secundario h-16" aria-label="Borrar">
          ⌫
        </button>
        <button type="button" onClick={() => tecla("0")} className="btn-secundario h-16 text-2xl">
          0
        </button>
        <button type="submit" disabled={pin.length < 4 || enviando} className="btn-primario h-16 text-lg">
          {enviando ? "…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}

export function PrimerDuenoForm() {
  const [estado, accion, enviando] = useActionState(crearDueno, undefined);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted">Primera vez: crea la cuenta del dueño.</p>
      <label className="campo">
        Tu nombre
        <input name="nombre" required maxLength={40} autoComplete="name" />
      </label>
      <label className="campo">
        PIN (4 a 6 números)
        <input name="pin" required inputMode="numeric" pattern="\d{4,6}" type="password" autoComplete="new-password" />
      </label>
      <label className="campo">
        Repite el PIN
        <input name="pin2" required inputMode="numeric" pattern="\d{4,6}" type="password" autoComplete="new-password" />
      </label>
      <p role="alert" className="min-h-5 text-sm text-red-600">
        {estado?.error}
      </p>
      <button disabled={enviando} className="btn-primario h-12">
        {enviando ? "Creando…" : "Crear y entrar"}
      </button>
    </form>
  );
}
