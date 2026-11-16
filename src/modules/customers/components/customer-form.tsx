"use client";

import { useActionState } from "react";
import { saveCustomer } from "../actions";

type Option = { id: string; name: string };
export type CustomerDraft = {
  id: string;
  name: string;
  phone: string;
  routeId: string;
  address: string;
  reference: string;
  creditLimit: string; // soles text, "" = no limit
  active: boolean;
};

const field = "h-12 rounded-xl border border-border bg-surface px-3";

export function CustomerForm({ routes, initial }: { routes: Option[]; initial: CustomerDraft }) {
  const [state, action, pending] = useActionState(saveCustomer, undefined);
  const editing = !!initial.id;
  return (
    <form action={action} className="tarjeta flex flex-col gap-3">
      <input type="hidden" name="id" value={initial.id} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre
          <input name="name" required maxLength={80} defaultValue={initial.name} placeholder="Bodega Rosa" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Teléfono
          <input name="phone" type="tel" inputMode="numeric" defaultValue={initial.phone} placeholder="987654321" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ruta
          <select name="routeId" required defaultValue={initial.routeId} className={field}>
            <option value="">Elige…</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details open={!!(initial.address || initial.reference || initial.creditLimit)}>
        <summary className="cursor-pointer text-sm text-primary">Más opciones</summary>
        <div className="grid gap-3 pt-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Dirección
            <input name="address" maxLength={150} defaultValue={initial.address} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Referencia
            <input name="reference" maxLength={150} defaultValue={initial.reference} placeholder="Frente al mercado" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Límite de crédito (S/)
            <input name="creditLimit" inputMode="decimal" defaultValue={initial.creditLimit} placeholder="Sin límite" className={field} />
          </label>
        </div>
      </details>
      {editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" value="true" defaultChecked={initial.active} /> Activo
        </label>
      )}
      <button disabled={pending} className="btn-primario h-12">
        {editing ? "Guardar" : "Crear cliente"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
