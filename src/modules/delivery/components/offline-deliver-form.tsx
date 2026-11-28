"use client";

import { useState } from "react";
import { PAYMENT_METHODS } from "@/lib/payment";
import { formatSoles, parseSoles } from "@/lib/money";
import { deliveredTotal, validateOp, type OfflineOp } from "../offline-queue";
import type { RouteOrder } from "../route-snapshot";

type Saved = Pick<OfflineOp, "lines" | "paid" | "method">;

const step = "flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-xl font-bold disabled:opacity-40";

/** Delivery of one order on the phone, with or without signal: quantities per line (default: ordered) and what the customer paid. */
export function OfflineDeliverForm({
  order,
  debt,
  onSave,
  onClose,
}: {
  order: RouteOrder;
  debt: number;
  onSave: (op: Saved) => Promise<void>;
  onClose: () => void;
}) {
  const all = () => Object.fromEntries(order.lines.map((l) => [l.packagingId, l.quantity]));
  const [delivered, setDelivered] = useState<Record<string, number>>(all);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState<Saved["method"]>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lines = order.lines.map((l) => ({ packagingId: l.packagingId, delivered: delivered[l.packagingId] ?? 0 }));
  const total = deliveredTotal(order, lines);
  const paidCents = paid.trim() ? parseSoles(paid) : 0;
  const owes = debt + total - (paidCents ?? 0);
  const put = (l: RouteOrder["lines"][number], n: number) =>
    setDelivered((s) => ({ ...s, [l.packagingId]: Math.min(l.quantity, Math.max(0, Math.trunc(n) || 0)) }));

  const save = async () => {
    if (paidCents === null) return setError("Monto inválido; escribe por ejemplo 5 o 5.50");
    const op = { lines, paid: paidCents, method };
    const invalid = validateOp(order, debt, op);
    if (invalid) return setError(invalid);
    setSaving(true);
    try {
      await onSave(op);
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar en este celular; inténtalo otra vez.");
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">¿Cuánto entregaste?</p>
        <button type="button" onClick={() => setDelivered(all())} className="text-sm font-semibold text-primary">
          Entregar todo
        </button>
      </div>
      <ul className="lista">
        {order.lines.map((l) => {
          const d = delivered[l.packagingId] ?? 0;
          return (
            <li key={l.packagingId} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0">
              <div className="min-w-0 flex-1 basis-32">
                <p className="font-semibold leading-tight">{l.product}</p>
                <p className="text-sm text-muted">
                  pidió {l.quantity} {l.packaging} · {formatSoles(l.price)} c/u
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => put(l, d - 1)} disabled={d === 0} className={step} aria-label="Uno menos">
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={l.quantity}
                  value={d}
                  onChange={(e) => put(l, Number(e.target.value))}
                  aria-label={`Entregado de ${l.product}`}
                  className={`h-12 w-16 rounded-xl border bg-surface px-2 text-center font-semibold ${d < l.quantity ? "border-amber-400" : "border-border"}`}
                />
                <button type="button" onClick={() => put(l, d + 1)} disabled={d === l.quantity} className={step} aria-label="Uno más">
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-baseline justify-between px-1">
        <span className="text-sm text-muted">Total entregado</span>
        <span className="cifra text-lg">{formatSoles(total)}</span>
      </p>
      <input
        inputMode="decimal"
        value={paid}
        onChange={(e) => setPaid(e.target.value)}
        placeholder="Pagó (S/) · vacío = fiado"
        aria-label="Pagó (S/)"
        className="h-12 rounded-xl border border-border bg-surface px-3"
      />
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Medio de pago">
        {PAYMENT_METHODS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMethod(v)}
            aria-pressed={method === v}
            className={`h-12 rounded-xl border font-semibold ${method === v ? "border-teal-600 bg-teal-50 text-teal-800" : "border-border bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p
        className={`flex items-baseline justify-between rounded-xl px-3 py-2 ${owes > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}
      >
        <span className="text-sm font-medium">{owes > 0 ? "Quedará debiendo" : "Queda al día"}</span>
        <span className="cifra text-lg">{formatSoles(Math.max(0, owes))}</span>
      </p>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={saving || total === 0} className="btn-primario btn-entregar h-[52px] w-full text-base">
        {saving ? "Guardando…" : `Confirmar entrega · ${formatSoles(total)}`}
      </button>
      <button type="button" onClick={onClose} disabled={saving} className="btn-secundario h-12 w-full">
        No entregado
      </button>
    </div>
  );
}
