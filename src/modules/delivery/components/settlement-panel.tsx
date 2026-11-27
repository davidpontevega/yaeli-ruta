"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Stat } from "@/components/ui/stat";
import { formatSoles, parseSoles } from "@/lib/money";
import { paymentLabel } from "@/lib/payment";
import { formatQty } from "@/lib/quantity";
import type { Settlement, SheetOrder } from "../queries";
import { settleSheet } from "../actions";

const diffTone = (d: number) => (d === 0 ? "text-emerald-700" : "text-amber-700");

/** EN_RUTA: pending orders (Entregar), delivered, payments by method, cash expected vs handed in, vehicle leftovers and "Cerrar ruta". LIQUIDADA: read-only summary. */
export function SettlementPanel({
  sheetId,
  status,
  pending,
  settlement: s,
}: {
  sheetId: string;
  status: "EN_RUTA" | "LIQUIDADA";
  pending: SheetOrder[];
  settlement: Settlement;
}) {
  const [state, action, busy] = useActionState(settleSheet, undefined);
  const [declared, setDeclared] = useState("");
  const settled = status === "LIQUIDADA";
  const sold = s.delivered.reduce((t, o) => t + o.total, 0);
  const expected = settled ? (s.expectedCash ?? 0) : s.expected;
  const handed = settled ? s.declaredCash : parseSoles(declared);
  const question = `¿Cerrar la ruta? El sobrante vuelve a su piso y la hoja se cierra.${
    pending.length
      ? `\n${pending.length} pedido${pending.length === 1 ? " queda" : "s quedan"} como no entregado${pending.length === 1 ? "" : "s"}.`
      : ""
  }`;

  const orderList = (list: { id: string; number: number; customerName: string; total: number }[], deliver: boolean) => (
    <ul className="lista">
      {list.map((o) => (
        <li key={o.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{o.customerName}</p>
            <span className="chip mt-1 bg-slate-100 text-slate-600">#{o.number}</span>
          </div>
          <span className="cifra shrink-0">{formatSoles(o.total)}</span>
          {deliver && (
            <Link href={`/pedidos/${o.id}/entregar`} className="btn-primario btn-entregar flex h-9 items-center text-sm">
              Entregar
            </Link>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <h2 className="rotulo">{settled ? "Ruta cerrada" : "Cerrar ruta"}</h2>
      {!settled && pending.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-muted">Por entregar</h3>
          {orderList(pending, true)}
        </>
      )}
      <h3 className="text-sm font-semibold text-muted">Entregados</h3>
      {s.delivered.length ? orderList(s.delivered, false) : <p className="tarjeta text-sm text-muted">Ningún pedido entregado.</p>}

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Vendido" value={formatSoles(sold)} />
        {s.byMethod.map((m) => (
          <Stat key={m.method} label={`Cobrado · ${paymentLabel(m.method ?? "")}`} value={formatSoles(m.amount)} />
        ))}
        <Stat label="Efectivo esperado" value={formatSoles(expected)} />
        {settled && <Stat label="Efectivo entregado" value={handed === null ? "—" : formatSoles(handed)} />}
        <Stat
          label="Diferencia"
          value={handed === null ? "—" : formatSoles(handed - expected)}
          tone={handed === null ? "" : diffTone(handed - expected)}
        />
      </div>

      {settled ? (
        s.settledAt && (
          <p className="text-sm text-muted">
            Ruta cerrada el {new Date(s.settledAt).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" })}
          </p>
        )
      ) : (
        <>
          <h3 className="text-sm font-semibold text-muted">Sobrante del vehículo</h3>
          {s.leftovers.length ? (
            <ul className="lista">
              {s.leftovers.map((l) => (
                <li key={l.productId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span>{l.productName}</span>
                  <span className="font-semibold">{formatQty(l.baseQty, s.packagings[l.productId] ?? [])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tarjeta text-sm text-muted">El vehículo está vacío.</p>
          )}
          <form action={action} onSubmit={(e) => !confirm(question) && e.preventDefault()} className="flex flex-col gap-2">
            <input type="hidden" name="sheetId" value={sheetId} />
            <input
              name="declared"
              required
              inputMode="decimal"
              placeholder="Efectivo entregado (S/)"
              aria-label="Efectivo entregado (S/)"
              value={declared}
              onChange={(e) => setDeclared(e.target.value)}
              className="h-12 rounded-xl border border-border bg-surface px-3"
            />
            {/* Only the current step's action is primary: while orders are pending, that is "Entregar". */}
            <button disabled={busy} className={`${pending.length ? "btn-secundario" : "btn-primario btn-cerrar"} h-12 w-full`}>
              Cerrar ruta
            </button>
            {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          </form>
        </>
      )}
    </div>
  );
}
