"use client";

import { PAYMENT_METHODS } from "@/lib/payment";
import { useActionState, useState } from "react";
import { formatSoles, toSolesInput } from "@/lib/money";
import { deliverOrder } from "../actions";

type Item = { packagingId: string; productName: string; packagingName: string; quantity: number; price: number; factor: number; stock: number };

/** Delivered quantity per line (default: ordered), and what the customer paid now. */
export function DeliveryForm({ orderId, items, balance }: { orderId: string; items: Item[]; balance: number }) {
  const [state, action, pending] = useActionState(deliverOrder, undefined);
  const [delivered, setDelivered] = useState<Record<string, number>>(Object.fromEntries(items.map((i) => [i.packagingId, i.quantity])));
  const [paid, setPaid] = useState("");
  const total = items.reduce((s, i) => s + (delivered[i.packagingId] ?? 0) * i.price, 0);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      {items.map((i) => {
        const d = delivered[i.packagingId] ?? 0;
        const inStock = Math.floor(i.stock / i.factor);
        return (
          <div key={i.packagingId} className="tarjeta flex flex-col gap-2">
            <p className="font-semibold leading-tight">{i.productName}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">
                Pidió {i.quantity} {i.packagingName} · {formatSoles(i.price)} c/u
              </span>
              <label className="flex items-center gap-1">
                Entregado
                <input
                  type="number"
                  inputMode="numeric"
                  name={`delivered_${i.packagingId}`}
                  min={0}
                  max={i.quantity}
                  value={d}
                  onChange={(e) =>
                    setDelivered({ ...delivered, [i.packagingId]: Math.min(i.quantity, Math.max(0, Math.trunc(Number(e.target.value)))) })
                  }
                  className="h-10 w-20 rounded-xl border border-border bg-surface px-3"
                />
              </label>
              <span className="ml-auto font-semibold">{formatSoles(d * i.price)}</span>
            </div>
            <p className={`text-xs ${d * i.factor > i.stock ? "font-semibold text-amber-700" : "text-muted"}`}>
              Almacén: {inStock} {i.packagingName}
            </p>
          </div>
        );
      })}
      <p className="flex justify-between text-lg font-bold">
        <span>Total entregado</span>
        <span>{formatSoles(total)}</span>
      </p>
      <div className="tarjeta flex flex-col gap-2">
        <p className="text-sm text-muted">{balance > 0 ? `Ya debía ${formatSoles(balance)}` : "No debía nada"}</p>
        <div className="flex flex-wrap gap-2">
          <input
            name="paid"
            inputMode="decimal"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="Pagó ahora S/"
            aria-label="Pagó ahora"
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
          />
          <button type="button" onClick={() => setPaid(toSolesInput(total))} className="btn-secundario h-12 text-sm">
            Pagó todo
          </button>
        </div>
        <select name="method" defaultValue="EFECTIVO" aria-label="Medio de pago" className="h-12 rounded-xl border border-border bg-surface px-2">
          {PAYMENT_METHODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <button disabled={pending || total === 0} className="btn-primario h-12">
        Confirmar entrega
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
