"use client";

import { useActionState } from "react";
import { saveRoute } from "../actions";
import { DAY_NAMES } from "../route-days";

export function RouteForm({ initial }: { initial?: { id: string; name: string; days: number[] } }) {
  const [state, action, pending] = useActionState(saveRoute, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <label className="campo-etiqueta">
        Nombre de la ruta
        <input name="name" required defaultValue={initial?.name} placeholder="Ej. Ruta Norte" />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">Días de visita</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((d, i) => (
            <label key={d} className="pastilla min-w-0 px-0">
              <input type="checkbox" name="days" value={i + 1} defaultChecked={initial?.days.includes(i + 1)} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <button disabled={pending} className="btn-primario h-11 text-sm">
        {initial ? "Guardar cambios" : "Crear ruta"}
      </button>
      {(state?.error || state?.ok) && (
        <p className={`rounded-xl px-3 py-2 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-800"}`}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
