"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ProductPicker } from "@/components/ui/product-picker";
import { formatSoles } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { cancelOrder, saveOrder } from "../actions";
import { MAX_QTY, defaultPackaging, mergeLine, orderTotal, type Line } from "../order-math";

type Packaging = { id: string; name: string; factor: number; salePrice: number };
type Product = { id: string; name: string; sku: string; packagings: Packaging[] };

export function OrderForm({
  products,
  available,
  customer,
  initial,
  lastOrder,
  today,
  account,
}: {
  products: Product[];
  available: Record<string, number>; // base units per product, other pending orders already subtracted
  customer: { id: string; name: string; routeName: string };
  initial: { id?: string; deliveryOn: string; lines: Line[] };
  lastOrder: { lines: Line[]; omitted: number } | null;
  today: string;
  account: { balance: number; creditLimit: number | null }; // balance excludes this order (not delivered yet)
}) {
  const [state, action, pending] = useActionState(saveOrder, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelOrder, undefined);
  const [lines, setLines] = useState(initial.lines);
  const [deliveryOn, setDeliveryOn] = useState(initial.deliveryOn);
  const [notice, setNotice] = useState("");
  const [repeated, setRepeated] = useState(false);

  const byPackaging = new Map(products.flatMap((p) => p.packagings.map((x) => [x.id, { product: p, packaging: x }] as const)));
  const known = lines.filter((l) => byPackaging.has(l.packagingId));
  const priced = known.map((l) => ({ ...l, price: byPackaging.get(l.packagingId)!.packaging.salePrice }));
  const usedBase = (productId: string) =>
    known
      .filter((l) => byPackaging.get(l.packagingId)!.product.id === productId)
      .reduce((s, l) => s + l.quantity * byPackaging.get(l.packagingId)!.packaging.factor, 0);

  const add = (p: Product) => {
    const x = defaultPackaging(p.packagings);
    if (x) setLines((ls) => mergeLine(ls, { packagingId: x.id, quantity: 1 }));
  };
  const repeat = () => {
    if (!lastOrder) return;
    const ok = lastOrder.lines.filter((l) => byPackaging.has(l.packagingId));
    setLines((ls) => ok.reduce(mergeLine, ls));
    setRepeated(true); // a second tap would double the quantities
    const omitted = lastOrder.omitted + lastOrder.lines.length - ok.length;
    setNotice(omitted ? `Se omitieron ${omitted} producto(s) inactivo(s).` : "");
  };
  const setLine = (packagingId: string, patch: Partial<Line>) =>
    setLines((ls) => {
      const next = { ...ls.find((l) => l.packagingId === packagingId)!, ...patch };
      const rest = ls.filter((l) => l.packagingId !== packagingId);
      // Switching to a packaging already in the order merges both lines.
      return rest.some((l) => l.packagingId === next.packagingId) ? mergeLine(rest, next) : ls.map((l) => (l.packagingId === packagingId ? next : l));
    });

  const data = JSON.stringify({ id: initial.id, customerId: customer.id, deliveryOn, lines: known });

  const totalBox = (placement: string) => (
    <div className={`tarjeta flex flex-col gap-2.5 ${placement}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">
          {known.length} producto{known.length === 1 ? "" : "s"}
        </span>
        <span className="cifra text-2xl">{formatSoles(orderTotal(priced))}</span>
      </div>
      <button disabled={pending || !known.length} className="btn-primario h-[52px] text-base">
        {initial.id ? "Guardar cambios" : "Guardar pedido"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Phone: one column. Desktop: lines on the left, customer card on the right. */}
      <form action={action} className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <input type="hidden" name="data" value={data} />
        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:order-2">
          <div className="tarjeta flex flex-col gap-2">
            <p className="font-semibold leading-tight">
              {customer.name} <span className="text-sm font-normal text-muted">· {customer.routeName}</span>
            </p>
            <p className="text-sm">
              <span className={account.balance > 0 ? "font-semibold text-red-600" : "text-muted"}>
                {account.balance > 0 ? `Debe ${formatSoles(account.balance)}` : "Al día"}
              </span>
              {account.creditLimit !== null && <span className="text-muted"> · Límite {formatSoles(account.creditLimit)}</span>}
            </p>
            {account.creditLimit !== null && account.balance + orderTotal(priced) > account.creditLimit && (
              <p className="text-sm font-semibold text-amber-700">Con este pedido pasa su límite</p>
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              Entrega
              <input
                type="date"
                required
                min={today}
                value={deliveryOn}
                onChange={(e) => setDeliveryOn(e.target.value)}
                className="h-10 rounded-xl border border-border bg-surface px-3"
              />
            </label>
          </div>

          {lastOrder && lastOrder.lines.length > 0 && (
            <button type="button" onClick={repeat} disabled={repeated} className="btn-secundario h-12 disabled:opacity-40">
              Repetir último pedido
            </button>
          )}
          {notice && <p className="text-sm text-amber-700">{notice}</p>}
          {lines.length > known.length && (
            <p className="text-sm text-amber-700">{lines.length - known.length} producto(s) inactivo(s) se quitarán al guardar.</p>
          )}
          {totalBox("hidden lg:flex")}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:order-1">
          {/* Search first: adding a product never moves it out of sight. */}
          <div className="tarjeta p-3">
            <ProductPicker products={products} onPick={add} placeholder={known.length ? "+ Agregar otro producto" : "Busca el producto"} />
          </div>
          {/* Newest first, right under the search, so what you just added is in view. */}
          {[...known].reverse().map((l) => {
            const { product, packaging } = byPackaging.get(l.packagingId)!;
            const free = available[product.id] ?? 0;
            const short = usedBase(product.id) > free;
            return (
              <div key={l.packagingId} className="tarjeta flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{product.name}</p>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((x) => x.packagingId !== l.packagingId))}
                    className="text-sm text-red-600"
                  >
                    Quitar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-xl border border-border">
                    <button
                      type="button"
                      aria-label="Menos"
                      onClick={() => setLine(l.packagingId, { quantity: Math.max(1, l.quantity - 1) })}
                      className="h-11 w-11 bg-slate-50 text-lg active:bg-slate-100"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_QTY}
                      value={l.quantity || ""}
                      onChange={(e) => setLine(l.packagingId, { quantity: Math.min(MAX_QTY, Math.max(0, Math.trunc(Number(e.target.value)))) })}
                      aria-label="Cantidad"
                      className="h-11 w-12 border-0 bg-surface text-center font-bold outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Más"
                      onClick={() => setLine(l.packagingId, { quantity: Math.min(MAX_QTY, l.quantity + 1) })}
                      className="h-11 w-11 bg-slate-50 text-lg active:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                  <select
                    value={l.packagingId}
                    onChange={(e) => setLine(l.packagingId, { packagingId: e.target.value })}
                    aria-label="Presentación"
                    className="h-10 rounded-xl border border-border bg-surface px-2"
                  >
                    {product.packagings.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {formatSoles(x.salePrice)}
                      </option>
                    ))}
                  </select>
                  <p className="cifra ml-auto text-[15px]">{formatSoles(l.quantity * packaging.salePrice)}</p>
                </div>
                <p className={`text-xs ${short ? "font-semibold text-amber-700" : "text-muted"}`}>
                  {short && "Falta stock · "}Disp.: {free ? formatQty(free, product.packagings) : "sin stock"}
                </p>
              </div>
            );
          })}

          {/* Phone: total and save stick above the bottom bar. Desktop: they live in the right column. */}
          {totalBox("sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden")}
        </div>
      </form>

      {initial.id && (
        <Link href={`/pedidos/${initial.id}/entregar`} className="btn-secundario flex h-12 items-center justify-center">
          Entregar
        </Link>
      )}
      {initial.id && (
        <form action={cancelAction} onSubmit={(e) => !confirm("¿Anular este pedido?") && e.preventDefault()}>
          <input type="hidden" name="id" value={initial.id} />
          <button disabled={cancelling} className="h-12 w-full rounded-xl border border-red-300 text-red-600">
            Anular pedido
          </button>
          {cancelState?.error && <p className="text-sm text-red-600">{cancelState.error}</p>}
        </form>
      )}
    </div>
  );
}
