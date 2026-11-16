"use client";

import { useActionState } from "react";
import { saveInitialDebts } from "../actions";
import type { InitialDebtRow } from "../queries";

/** One amount per customer and a single notebook date for all. Saved rows disappear from the list (the page re-renders). */
export function InitialDebtForm({ customers, today }: { customers: InitialDebtRow[]; today: string }) {
  const [state, action, pending] = useActionState(saveInitialDebts, undefined);
  const groups = Map.groupBy(customers, (c) => c.routeName);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="tarjeta flex flex-col gap-1 text-sm font-medium">
        Fecha del cuaderno
        <input type="date" name="date" required max={today} defaultValue={today} className="h-12 rounded-xl border border-border bg-surface px-3" />
      </label>
      {customers.length ? (
        <div className="grupos">
          {[...groups].map(([routeName, list]) => (
            <section key={routeName} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase text-muted">{routeName}</h2>
              <div className="lista">
                {list.map((c) => (
                  <label key={c.id} className="fila flex items-center gap-3">
                    <span className="min-w-0 flex-1 font-semibold leading-tight">{c.name}</span>
                    <input
                      name={`amount_${c.id}`}
                      inputMode="decimal"
                      placeholder="S/ 0.00"
                      aria-label={`Deuda de ${c.name}`}
                      className="h-10 w-28 rounded-xl border border-border bg-surface px-3 text-right"
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="tarjeta text-muted">Todos los clientes ya tienen su deuda inicial.</p>
      )}
      {customers.length > 0 && (
        <button disabled={pending} className="btn-primario sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] h-12 md:bottom-4">
          Guardar deudas
        </button>
      )}
      {(state?.error || state?.ok) && <p className={`text-sm ${state.error ? "text-red-600" : "text-primary"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}
