"use client";

import { PAYMENT_METHODS } from "@/lib/payment";
import { useActionState } from "react";
import { registerPayment } from "../actions";

export function PaymentForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(registerPayment, undefined);
  return (
    <form action={action} className="tarjeta flex flex-col gap-2">
      <p className="font-semibold">Registrar cobro</p>
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex flex-wrap gap-2">
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="Monto S/"
          aria-label="Monto"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
        />
        <select name="method" defaultValue="EFECTIVO" aria-label="Medio de pago" className="h-12 rounded-xl border border-border bg-surface px-2">
          {PAYMENT_METHODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <button disabled={pending} className="btn-primario h-12">
        Cobrar
      </button>
      {(state?.error || state?.ok) && <p className={`text-sm ${state.error ? "text-red-600" : "text-primary"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}
