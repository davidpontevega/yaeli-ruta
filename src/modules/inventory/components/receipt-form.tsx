"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { formatSoles, parseSoles, toSolesInput } from "@/lib/money";
import type { ReceiptType } from "@/server/db/schema";
import { receiveGoods } from "../actions";

type Option = { id: string; name: string };
export type ReceivableProduct = {
  id: string;
  name: string;
  sku: string;
  packagings: { id: string; name: string; factor: number }[];
};
type Line = {
  key: string;
  product: ReceivableProduct;
  packagingId: string;
  quantity: string;
  unitCost: string;
  expiresOn: string;
  locationId: string;
};

const MAX_RESULTS = 8;
let seq = 0;

const largest = (p: ReceivableProduct) => p.packagings.reduce((a, b) => (b.factor > a.factor ? b : a));
export function ReceiptForm({
  products,
  locations,
  lastCosts,
}: {
  products: ReceivableProduct[];
  locations: Option[];
  /** Last purchase cost (céntimos) per packaging id, to prefill. */
  lastCosts: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(receiveGoods, undefined);
  const [type, setType] = useState<ReceiptType>("COMPRA");
  const [supplier, setSupplier] = useState("");
  const [document, setDocument] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const term = q.trim().toLowerCase();
  const results =
    term.length < 2 ? [] : products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)).slice(0, MAX_RESULTS);

  const costFor = (packagingId: string) => (lastCosts[packagingId] ? toSolesInput(lastCosts[packagingId]) : "");
  const add = (p: ReceivableProduct) => {
    const pack = largest(p);
    setLines((s) => [
      ...s,
      {
        key: `l${seq++}`,
        product: p,
        packagingId: pack.id,
        quantity: "1",
        unitCost: costFor(pack.id),
        expiresOn: "",
        locationId: s.at(-1)?.locationId ?? locations[0]?.id ?? "",
      },
    ]);
    setQ("");
  };
  const update = (key: string, patch: Partial<Line>) => setLines((s) => s.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = (l: Line) => (parseSoles(l.unitCost) ?? 0) * (Number(l.quantity) || 0);
  const total = lines.reduce((s, l) => s + subtotal(l), 0);
  const data = JSON.stringify({
    type,
    supplier: type === "COMPRA" ? supplier : "",
    document: type === "COMPRA" ? document : "",
    items: lines.map(({ packagingId, quantity, unitCost, expiresOn, locationId }) => ({
      packagingId,
      quantity,
      unitCost,
      expiresOn,
      locationId,
    })),
  });

  if (!locations.length) return <p className="tarjeta text-muted">Primero agrega un piso del almacén en Catálogo.</p>;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="data" value={data} />

      <div className="tarjeta flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["COMPRA", "Llegó mercadería"],
              ["SALDO_INICIAL", "Ya lo tengo (inventario inicial)"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={`min-h-12 rounded-xl border px-2 text-sm font-medium ${type === value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {type === "COMPRA" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="campo">
              Proveedor (opcional)
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={80} />
            </label>
            <label className="campo">
              N° guía / factura (opcional)
              <input value={document} onChange={(e) => setDocument(e.target.value)} maxLength={80} />
            </label>
          </div>
        )}
      </div>

      {lines.map((l) => {
        const pack = l.product.packagings.find((x) => x.id === l.packagingId)!;
        return (
          <div key={l.key} className="tarjeta flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold leading-tight">{l.product.name}</p>
              <button type="button" onClick={() => setLines((s) => s.filter((x) => x.key !== l.key))} className="text-muted" aria-label="Quitar">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="campo">
                Cantidad
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={l.quantity}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                  required
                />
              </label>
              <label className="campo">
                De
                <select
                  value={l.packagingId}
                  onChange={(e) => {
                    update(l.key, {
                      packagingId: e.target.value,
                      unitCost: costFor(e.target.value),
                    });
                  }}
                >
                  {l.product.packagings.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.factor > 1 && ` ×${x.factor}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Costo c/{pack.name} S/
                <input
                  inputMode="decimal"
                  value={l.unitCost}
                  onChange={(e) => update(l.key, { unitCost: e.target.value })}
                  required
                  placeholder="0.00"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo">
                Vence (si tiene)
                <input type="date" value={l.expiresOn} onChange={(e) => update(l.key, { expiresOn: e.target.value })} />
              </label>
              <label className="campo">
                Dónde lo guardas
                <select value={l.locationId} onChange={(e) => update(l.key, { locationId: e.target.value })}>
                  {locations.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-right text-sm text-muted">Subtotal {formatSoles(subtotal(l))}</p>
          </div>
        );
      })}

      <div className="tarjeta flex flex-col gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lines.length ? "+ Agregar otro producto" : "Busca el producto que llegó"}
          aria-label="Buscar producto"
          className="h-12 rounded-xl border border-border bg-surface px-3"
        />
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => add(p)}
            className="rounded-xl border border-border px-3 py-2 text-left text-sm active:bg-slate-100"
          >
            {p.name} <span className="text-muted">· {p.sku}</span>
          </button>
        ))}
        {term.length >= 2 && !results.length && <p className="text-sm text-muted">No se encontró. Créalo primero en Productos.</p>}
      </div>

      <p className="text-right font-semibold">Total {formatSoles(total)}</p>
      <p role="alert" className="min-h-5 text-sm text-red-600">
        {state?.error}
      </p>
      <div className="flex gap-2">
        <Link href="/stock" className="btn-secundario flex h-12 flex-1 items-center justify-center">
          Cancelar
        </Link>
        <button disabled={pending || !lines.length} className="btn-primario h-12 flex-1">
          {pending ? "Guardando…" : "Guardar ingreso"}
        </button>
      </div>
    </form>
  );
}
