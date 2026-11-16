"use client";

import { useActionState } from "react";
import { adjustBalance } from "../actions";

export function AdjustmentForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(adjustBalance, undefined);
  return (
    <details className="tarjeta">
      <summary className="cursor-pointer text-sm text-primary">Ajustar saldo</summary>
      <form action={action} className="flex flex-col gap-2 pt-3">
        <input type="hidden" name="customerId" value={customerId} />
        <input
          name="amount"
          required
          placeholder="+20 sube la deuda, -20 la baja"
          aria-label="Monto con signo"
          className="h-12 rounded-xl border border-border bg-surface px-3"
        />
        <input
          name="note"
          required
          minLength={3}
          maxLength={200}
          placeholder="Motivo"
          aria-label="Motivo"
          className="h-12 rounded-xl border border-border bg-surface px-3"
        />
        <button disabled={pending} className="btn-secundario h-12">
          Guardar ajuste
        </button>
        {(state?.error || state?.ok) && <p className={`text-sm ${state.error ? "text-red-600" : "text-primary"}`}>{state.error ?? state.ok}</p>}
      </form>
    </details>
  );
}
