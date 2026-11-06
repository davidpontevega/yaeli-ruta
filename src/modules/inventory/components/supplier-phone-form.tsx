"use client";

import { useActionState } from "react";
import { updateSupplierPhone } from "../actions";

export function SupplierPhoneForm({ id, phone }: { id: string; phone: string | null }) {
  const [state, action, pending] = useActionState(updateSupplierPhone, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={phone ?? ""}
        placeholder="Teléfono"
        aria-label="Teléfono"
        maxLength={30}
        className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
      />
      <button disabled={pending} className="btn-secundario h-10 text-sm">
        Guardar
      </button>
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="btn-secundario flex h-10 items-center text-sm">
          Llamar
        </a>
      )}
      {(state?.error || state?.ok) && <p className={`w-full text-sm ${state.error ? "text-red-600" : "text-primary"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}
