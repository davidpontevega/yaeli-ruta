"use client";

import { PAYMENT_METHODS } from "@/lib/payment";
import { useActionState, useState } from "react";
import { formatSoles, parseSoles, toSolesInput } from "@/lib/money";
import { Avatar } from "@/components/ui/avatar";
import { deliverOrder } from "../actions";

type Item = { packagingId: string; productName: string; packagingName: string; quantity: number; price: number; factor: number; stock: number };

const step = "flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-lg font-bold disabled:opacity-40";

/** Delivered quantity per line (default: ordered), and what the customer paid now; shows the debt left after it. */
export function DeliveryForm({ orderId, items, balance }: { orderId: string; items: Item[]; balance: number }) {
  const [state, action, pending] = useActionState(deliverOrder, undefined);
  const [delivered, setDelivered] = useState<Record<string, number>>(Object.fromEntries(items.map((i) => [i.packagingId, i.quantity])));
  const [paid, setPaid] = useState("");
  const total = items.reduce((s, i) => s + (delivered[i.packagingId] ?? 0) * i.price, 0);
  const paidCents = parseSoles(paid) ?? 0;
  const owes = balance + total - paidCents;
  const short = items.filter((i) => (delivered[i.packagingId] ?? 0) < i.quantity).length;
  const put = (i: Item, n: number) => setDelivered((s) => ({ ...s, [i.packagingId]: Math.min(i.quantity, Math.max(0, Math.trunc(n) || 0)) }));

  return (
    <form action={action} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-sm text-muted">
            {short ? `${short} producto${short === 1 ? "" : "s"} con menos de lo pedido` : "Se entrega todo lo pedido"}
          </p>
          {short > 0 && (
            <button
              type="button"
              onClick={() => setDelivered(Object.fromEntries(items.map((i) => [i.packagingId, i.quantity])))}
              className="text-sm text-primary"
            >
              Entregar todo
            </button>
          )}
        </div>
        <ul className="lista">
          {items.map((i) => {
            const d = delivered[i.packagingId] ?? 0;
            const inStock = Math.floor(i.stock / i.factor);
            const lacks = d * i.factor > i.stock;
            return (
              <li key={i.packagingId} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <Avatar name={i.productName} size="sm" />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-semibold leading-tight">{i.productName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="chip bg-slate-100 text-slate-600">
                      pidió {i.quantity} {i.packagingName}
                    </span>
                    <span className="chip bg-slate-100 text-slate-600">{formatSoles(i.price)} c/u</span>
                    <span className={`chip ${lacks ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>almacén {inStock}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => put(i, d - 1)} disabled={d === 0} className={step} aria-label="Uno menos">
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    name={`delivered_${i.packagingId}`}
                    min={0}
                    max={i.quantity}
                    value={d}
                    onChange={(e) => put(i, Number(e.target.value))}
                    aria-label={`Entregado de ${i.productName}`}
                    className={`h-10 w-16 rounded-xl border bg-surface px-2 text-center font-semibold ${d < i.quantity ? "border-amber-400" : "border-border"}`}
                  />
                  <button type="button" onClick={() => put(i, d + 1)} disabled={d === i.quantity} className={step} aria-label="Uno más">
                    +
                  </button>
                </div>
                <span className="cifra w-20 text-right">{formatSoles(d * i.price)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="tarjeta flex flex-col gap-3 lg:sticky lg:top-6">
        <h2 className="font-bold">Cobro</h2>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Ya debía</dt>
            <dd className="cifra">{formatSoles(balance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Este pedido</dt>
            <dd className="cifra">{formatSoles(total)}</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <input
            name="paid"
            inputMode="decimal"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="Pagó ahora S/"
            aria-label="Pagó ahora"
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
          />
          <button type="button" onClick={() => setPaid(toSolesInput(total))} className="btn-suave h-12 px-3 text-sm">
            Pagó el pedido
          </button>
        </div>
        <select name="method" defaultValue="EFECTIVO" aria-label="Medio de pago" className="h-12 rounded-xl border border-border bg-surface px-2">
          {PAYMENT_METHODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <p
          className={`flex items-baseline justify-between rounded-xl px-3 py-2 ${owes > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}
        >
          <span className="text-sm font-medium">{owes > 0 ? "Quedará debiendo" : "Queda al día"}</span>
          <span className="cifra text-lg">{formatSoles(Math.max(0, owes))}</span>
        </p>
        <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 md:bottom-4 lg:static">
          <button
            disabled={pending || total === 0}
            className="btn-primario btn-entregar h-[52px] w-full text-base shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:shadow-none"
          >
            {pending ? "Guardando…" : `Confirmar entrega · ${formatSoles(total)}`}
          </button>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}
