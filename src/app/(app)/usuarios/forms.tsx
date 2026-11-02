"use client";

import { useActionState, useState } from "react";
import { cambiarPin, crearUsuario } from "./actions";

const pinProps = { required: true, inputMode: "numeric", pattern: "\\d{4,6}", type: "password", autoComplete: "new-password" } as const;

export function NuevoUsuarioForm() {
  const [estado, accion, enviando] = useActionState(crearUsuario, undefined);
  return (
    <form action={accion} className="tarjeta flex flex-col gap-3">
      <h2 className="font-semibold">Nuevo usuario</h2>
      <label className="campo">
        Nombre
        <input name="nombre" required maxLength={40} />
      </label>
      <label className="campo">
        Rol
        <select name="rol" defaultValue="REPARTIDOR">
          <option value="REPARTIDOR">Repartidor</option>
          <option value="DUENO">Dueño</option>
        </select>
      </label>
      <label className="campo">
        PIN (4 a 6 números)
        <input name="pin" {...pinProps} />
      </label>
      <p role="status" className={`min-h-5 text-sm ${estado?.error ? "text-red-600" : "text-primary"}`}>
        {estado?.error ?? estado?.ok}
      </p>
      <button disabled={enviando} className="btn-primario h-12">
        {enviando ? "Guardando…" : "Crear usuario"}
      </button>
    </form>
  );
}

export function CambiarPinForm({ usuarioId }: { usuarioId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(cambiarPin, undefined);

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn-secundario h-10 text-sm">
        Cambiar PIN
      </button>
    );

  if (estado?.ok)
    return <p className="flex h-10 items-center text-sm text-primary">{estado.ok}</p>;

  return (
    <form action={accion} className="flex w-full flex-wrap items-end gap-2">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <label className="campo flex-1">
        Nuevo PIN
        <input name="pin" {...pinProps} autoFocus />
      </label>
      <button disabled={enviando} className="btn-primario h-12">
        OK
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="btn-secundario h-12">
        ✕
      </button>
      {estado?.error && <p className="text-sm text-red-600">{estado.error}</p>}
    </form>
  );
}
