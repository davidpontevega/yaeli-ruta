"use client";

import { useActionState } from "react";
import { createSheet } from "../actions";

/** New sheet: route + date + vehicle. The route's pending orders of that date are added on create. */
export function SheetForm({
  routes,
  vehicles,
  date,
  today,
}: {
  routes: { id: string; name: string }[];
  vehicles: { id: string; name: string; capacityKg: number | null }[];
  date: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(createSheet, undefined);
  return (
    <form action={action} className="tarjeta flex flex-col gap-3">
      <h2 className="font-bold">Armar hoja de ruta</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="campo-etiqueta">
          Ruta
          <select name="routeId" required defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-etiqueta">
          Fecha
          <input type="date" name="date" required min={today} defaultValue={date < today ? today : date} />
        </label>
        <label className="campo-etiqueta">
          Vehículo
          <select name="vehicleId" required defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.capacityKg ? `${v.name} · ${v.capacityKg} kg` : v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={pending} className="btn-primario btn-armar h-11 text-sm">
        Crear hoja
      </button>
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
