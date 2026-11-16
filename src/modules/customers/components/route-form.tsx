"use client";

import { useActionState } from "react";
import { saveRoute } from "../actions";
import { DAY_NAMES } from "../route-days";

export function RouteForm({ initial }: { initial?: { id: string; name: string; days: number[] } }) {
  const [state, action, pending] = useActionState(saveRoute, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input
        name="name"
        required
        defaultValue={initial?.name}
        placeholder="Nombre de la ruta"
        aria-label="Nombre de la ruta"
        className="h-10 rounded-xl border border-border bg-surface px-3"
      />
      <fieldset className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <legend className="sr-only">Días de visita</legend>
        {DAY_NAMES.map((d, i) => (
          <label key={d} className="flex items-center gap-1">
            <input type="checkbox" name="days" value={i + 1} defaultChecked={initial?.days.includes(i + 1)} /> {d}
          </label>
        ))}
      </fieldset>
      <button disabled={pending} className="btn-primario h-10 self-start text-sm">
        {initial ? "Guardar" : "Crear ruta"}
      </button>
      {(state?.error || state?.ok) && <p className={`text-sm ${state.error ? "text-red-600" : "text-primary"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}
