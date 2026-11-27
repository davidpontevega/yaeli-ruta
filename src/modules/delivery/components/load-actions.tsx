"use client";

import { useActionState } from "react";
import { loadVehicle, unloadVehicle } from "../actions";

/** PREPARANDO: "Cargar vehículo" (warns about shortages). EN_RUTA: "Devolver al almacén". Both ask for confirmation. */
export function LoadActions({ sheetId, status, short }: { sheetId: string; status: "PREPARANDO" | "EN_RUTA"; short: number }) {
  const loading = status === "PREPARANDO";
  const [state, action, pending] = useActionState(loading ? loadVehicle : unloadVehicle, undefined);
  const question = loading
    ? `¿Cargar el vehículo? El stock pasa de los pisos al vehículo.${short ? `\n${short} producto${short === 1 ? "" : "s"} con faltante: se carga lo que hay.` : ""}`
    : "¿Devolver toda la carga al almacén? La hoja vuelve a preparación.";
  return (
    <form action={action} onSubmit={(e) => !confirm(question) && e.preventDefault()} className="flex flex-col gap-2 print:hidden">
      <input type="hidden" name="sheetId" value={sheetId} />
      <button disabled={pending} className={`${loading ? "btn-primario btn-cargar" : "btn-secundario"} h-12 w-full`}>
        {loading ? "Cargar vehículo" : "Devolver al almacén"}
      </button>
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
