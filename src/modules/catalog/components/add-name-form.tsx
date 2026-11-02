"use client";

import { useActionState } from "react";
import { addCatalogName } from "../actions";

export function AddNameForm({ kind }: { kind: "category" | "brand" | "location" }) {
  const [state, action, pending] = useActionState(addCatalogName, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input name="name" required placeholder="Nuevo…" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3" />
      {kind === "location" && (
        <select name="locationType" className="h-10 rounded-xl border border-border bg-surface px-2">
          <option value="ALMACEN">Almacén</option>
          <option value="VEHICULO">Vehículo</option>
        </select>
      )}
      <button disabled={pending} className="btn-primario h-10 text-sm">
        Agregar
      </button>
      {(state?.error || state?.ok) && <p className={`w-full text-sm ${state.error ? "text-red-600" : "text-primary"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}
