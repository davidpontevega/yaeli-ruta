"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { formatSoles, parseSoles, toSolesInput } from "@/lib/money";
import type { ReceiptType } from "@/server/db/schema";
import { receiveGoods } from "../actions";
import { costFromLine, matchLine, type LineMatch, type ReadDocument } from "../document-read";
import { ProductPicker } from "./product-picker";
import { ReadDocumentButton } from "./read-document-button";

type Option = { id: string; name: string };
export type ReceivableProduct = {
  id: string;
  name: string;
  sku: string;
  packagings: { id: string; name: string; factor: number }[];
};
type Line = {
  key: string;
  product: ReceivableProduct | null; // null = read from a document, product not found yet
  packagingId: string;
  quantity: string;
  unitCost: string;
  expiresOn: string;
  locationId: string;
  readText?: string;
  status?: LineMatch["status"];
};

const STATUS: Record<LineMatch["status"], { label: string; className: string }> = {
  alias: { label: "aprendido", className: "bg-emerald-100 text-emerald-800" },
  suggested: { label: "sugerido, revisa", className: "bg-amber-100 text-amber-800" },
  none: { label: "elige producto", className: "bg-red-100 text-red-700" },
};

let seq = 0;
const largest = (p: ReceivableProduct) => p.packagings.reduce((a, b) => (b.factor > a.factor ? b : a));

export function ReceiptForm({
  products,
  locations,
  lastCosts,
  aliases,
  readerEnabled,
}: {
  products: ReceivableProduct[];
  locations: Option[];
  /** Last purchase cost (céntimos) per packaging id, to prefill. */
  lastCosts: Record<string, number>;
  /** Learned: normalized document text → packaging id. */
  aliases: Record<string, string>;
  readerEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(receiveGoods, undefined);
  const [type, setType] = useState<ReceiptType>("COMPRA");
  const [supplier, setSupplier] = useState("");
  const [document, setDocument] = useState("");
  const [readTotal, setReadTotal] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const costFor = (packagingId: string) => (lastCosts[packagingId] ? toSolesInput(lastCosts[packagingId]) : "");
  const lastLocation = (s: Line[]) => s.at(-1)?.locationId ?? locations[0]?.id ?? "";
  const add = (p: ReceivableProduct) => {
    const pack = largest(p);
    setLines((s) => [
      ...s,
      { key: `l${seq++}`, product: p, packagingId: pack.id, quantity: "1", unitCost: costFor(pack.id), expiresOn: "", locationId: lastLocation(s) },
    ]);
  };
  const update = (key: string, patch: Partial<Line>) => setLines((s) => s.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function addRead(doc: ReadDocument) {
    setType("COMPRA");
    if (!supplier && doc.supplier) setSupplier(doc.supplier);
    if (!document && doc.document) setDocument(doc.document);
    if (doc.total) setReadTotal((t) => (t ?? 0) + doc.total!);
    setLines((s) => [
      ...s,
      ...doc.lines.map((r): Line => {
        const m = matchLine(r, products, aliases);
        const cost = costFromLine(r);
        return {
          key: `l${seq++}`,
          product: products.find((p) => p.id === m.productId) ?? null,
          packagingId: m.packagingId ?? "",
          quantity: String(r.quantity),
          unitCost: cost !== null ? toSolesInput(cost) : m.packagingId ? costFor(m.packagingId) : "",
          expiresOn: r.expiresOn ?? "",
          locationId: lastLocation(s),
          readText: r.description,
          status: m.status,
        };
      }),
    ]);
  }

  const subtotal = (l: Line) => (parseSoles(l.unitCost) ?? 0) * (Number(l.quantity) || 0);
  const total = lines.reduce((s, l) => s + subtotal(l), 0);
  const missing = lines.filter((l) => !l.product).length;
  const data = JSON.stringify({
    type,
    supplier: type === "COMPRA" ? supplier : "",
    document: type === "COMPRA" ? document : "",
    items: lines.map(({ packagingId, quantity, unitCost, expiresOn, locationId, readText }) => ({
      packagingId,
      quantity,
      unitCost,
      expiresOn,
      locationId,
      readText,
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
          <>
            {readerEnabled && <ReadDocumentButton onRead={addRead} />}
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
          </>
        )}
      </div>

      {lines.map((l) => {
        const p = l.product;
        const pack = p?.packagings.find((x) => x.id === l.packagingId);
        return (
          <div key={l.key} className={`tarjeta flex flex-col gap-3 ${l.status && l.status !== "alias" ? "border-amber-300" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="font-semibold leading-tight">{p ? p.name : "Producto no encontrado"}</p>
                {l.readText && (
                  <p className="text-xs text-muted">
                    Leído: {l.readText}{" "}
                    {l.status && <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS[l.status].className}`}>{STATUS[l.status].label}</span>}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setLines((s) => s.filter((x) => x.key !== l.key))} className="text-muted" aria-label="Quitar">
                ✕
              </button>
            </div>
            {(!p || l.status === "suggested") && (
              <ProductPicker
                products={products}
                placeholder={p ? "¿No es este? Busca el correcto" : "Busca el producto"}
                onPick={(np) => {
                  const keep = np.packagings.find((x) => x.id === l.packagingId);
                  const next = keep ?? largest(np);
                  update(l.key, { product: np, packagingId: next.id, status: undefined, unitCost: l.unitCost || costFor(next.id) });
                }}
              />
            )}
            {p && (
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
                    onChange={(e) => update(l.key, { packagingId: e.target.value, unitCost: l.readText ? l.unitCost : costFor(e.target.value) })}
                  >
                    {p.packagings.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                        {x.factor > 1 && ` ×${x.factor}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  Costo c/{pack?.name} S/
                  <input
                    inputMode="decimal"
                    value={l.unitCost}
                    onChange={(e) => update(l.key, { unitCost: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </label>
              </div>
            )}
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
            {p && <p className="text-right text-sm text-muted">Subtotal {formatSoles(subtotal(l))}</p>}
          </div>
        );
      })}

      <div className="tarjeta">
        <ProductPicker products={products} onPick={add} placeholder={lines.length ? "+ Agregar otro producto" : "Busca el producto que llegó"} />
      </div>

      <div className="text-right">
        <p className="font-semibold">Total {formatSoles(total)}</p>
        {readTotal !== null && (
          <p className={`text-sm ${readTotal === total ? "text-muted" : "font-medium text-red-600"}`}>
            Total en el documento {formatSoles(readTotal)}
            {readTotal !== total && " — no cuadra, revisa"}
          </p>
        )}
      </div>
      <p role="alert" className="min-h-5 text-sm text-red-600">
        {missing > 0 ? `Falta elegir el producto en ${missing} línea${missing > 1 ? "s" : ""}` : state?.error}
      </p>
      <div className="flex gap-2">
        <Link href="/stock" className="btn-secundario flex h-12 flex-1 items-center justify-center">
          Cancelar
        </Link>
        <button disabled={pending || !lines.length || missing > 0} className="btn-primario h-12 flex-1">
          {pending ? "Guardando…" : "Guardar ingreso"}
        </button>
      </div>
    </form>
  );
}
