"use client";

import { useActionState, useState } from "react";
import { Avatar, ICONS, IconTile } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSoles, parseSoles } from "@/lib/money";
import { saveInitialDebts } from "../actions";
import type { InitialDebtRow } from "../queries";

/**
 * One amount per customer and a single notebook date for all; a live summary (how many, how much) stays in view.
 * Saved rows disappear from the list (the page re-renders).
 */
export function InitialDebtForm({ customers, today }: { customers: InitialDebtRow[]; today: string }) {
  const [state, action, pending] = useActionState(saveInitialDebts, undefined);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const groups = Map.groupBy(customers, (c) => c.routeName);
  // Only rows still listed: saved customers leave the list but their typed value stays in state.
  const filled = customers.map((c) => amounts[c.id] ?? "").filter((v) => v.trim());
  const total = filled.reduce((s, v) => s + (parseSoles(v) ?? 0), 0);
  const invalid = filled.some((v) => !parseSoles(v));

  if (!customers.length) return <EmptyState text="Todos los clientes ya tienen su deuda inicial." tone="bg-emerald-50 text-emerald-600" />;

  return (
    <form action={action} className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
        {[...groups].map(([routeName, list]) => {
          const n = list.filter((c) => amounts[c.id]?.trim()).length;
          return (
            <section key={routeName} className="lista">
              <header className="flex items-center gap-3 bg-slate-50/70 px-4 py-3">
                <IconTile d={ICONS.pin} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold leading-tight">{routeName}</h2>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="chip bg-slate-100 text-slate-700">
                      {list.length} cliente{list.length === 1 ? "" : "s"}
                    </span>
                    {n > 0 && <span className="chip bg-teal-50 text-teal-800">{n} con deuda escrita</span>}
                  </div>
                </div>
              </header>
              <ul className="celdas">
                {list.map((c) => {
                  const v = amounts[c.id] ?? "";
                  const bad = v.trim() !== "" && !parseSoles(v);
                  return (
                    <li key={c.id}>
                      <label className={`fila flex items-center gap-3 ${v.trim() && !bad ? "bg-teal-50/40" : ""}`}>
                        <Avatar name={c.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{c.name}</span>
                        <span
                          className={`flex h-10 w-32 shrink-0 items-center gap-1 rounded-xl border bg-surface px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-teal-100 ${bad ? "border-red-400" : "border-border"}`}
                        >
                          <span className="text-sm text-muted">S/</span>
                          <input
                            name={`amount_${c.id}`}
                            inputMode="decimal"
                            placeholder="0.00"
                            aria-label={`Deuda de ${c.name}`}
                            value={v}
                            onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value }))}
                            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-right font-semibold shadow-none outline-none focus:shadow-none"
                          />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Summary: on top on phones, sticky right column on desktop. */}
      <div className="tarjeta order-1 flex flex-col gap-3 lg:sticky lg:top-6 lg:order-2">
        <label className="campo-etiqueta">
          Fecha del cuaderno
          <input type="date" name="date" required max={today} defaultValue={today} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="block text-[11px] font-medium text-muted">Clientes con deuda</span>
            <span className="cifra text-lg">
              {filled.length} <span className="text-sm text-muted">de {customers.length}</span>
            </span>
          </div>
          <div className="rounded-xl bg-red-50 px-3 py-2">
            <span className="block text-[11px] font-medium text-red-800">Total a cargar</span>
            <span className="cifra text-lg text-red-700">{formatSoles(total)}</span>
          </div>
        </div>
        {invalid && <p className="text-sm text-red-600">Hay un monto mal escrito (en rojo). Usa números, ej. 120.50</p>}
        <button disabled={pending || !filled.length || invalid} className="btn-primario h-12">
          {pending ? "Guardando…" : `Guardar ${filled.length || ""} deuda${filled.length === 1 ? "" : "s"}`}
        </button>
        {(state?.error || state?.ok) && (
          <p className={`rounded-lg px-2.5 py-1.5 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
            {state.error ?? state.ok}
          </p>
        )}
      </div>
    </form>
  );
}
