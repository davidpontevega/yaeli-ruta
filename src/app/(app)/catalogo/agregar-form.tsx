"use client";

import { useActionState } from "react";
import { agregarNombre } from "../productos/actions";

export function AgregarForm({ tipo }: { tipo: "categoria" | "marca" | "ubicacion" }) {
  const [estado, accion, enviando] = useActionState(agregarNombre, undefined);
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="tipo" value={tipo} />
      <input name="nombre" required placeholder="Nuevo…" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3" />
      {tipo === "ubicacion" && (
        <select name="tipoUbicacion" className="h-10 rounded-xl border border-border bg-surface px-2">
          <option value="ALMACEN">Almacén</option>
          <option value="VEHICULO">Vehículo</option>
        </select>
      )}
      <button disabled={enviando} className="btn-primario h-10 text-sm">
        Agregar
      </button>
      {(estado?.error || estado?.ok) && (
        <p className={`w-full text-sm ${estado.error ? "text-red-600" : "text-primary"}`}>{estado.error ?? estado.ok}</p>
      )}
    </form>
  );
}
