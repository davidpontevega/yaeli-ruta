"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useActionState, useState } from "react";
import Link from "next/link";
import { formatSoles, parseSoles, toSolesInput } from "@/lib/money";
import type { ReceiptType } from "@/server/db/schema";
import { receiveGoods } from "../actions";
import { costFromLine, matchLine, type LineMatch, type ReadDocument } from "../document-read";
import { ProductPicker } from "@/components/ui/product-picker";
import { QuickProductPanel, type QuickProduct } from "@/components/ui/quick-product";
import { Avatar, Glyph, ICONS } from "@/components/ui/avatar";
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

type QuickResult = { error?: string; product?: QuickProduct; cost?: number; packagingId?: string };

export function ReceiptForm({
  products: initialProducts,
  categories,
  quickCreateProduct,
  suppliersById,
  locations,
  lastCosts,
  aliases,
  aiEnabled,
  supplierNames,
  initial,
}: {
  products: ReceivableProduct[];
  /** For creating a missing product from here (server action passed by the page). */
  categories: Option[];
  quickCreateProduct: (state: QuickResult | undefined, form: FormData) => Promise<QuickResult>;
  /** Supplier name → id, so a product created here takes the supplier typed in the receipt. */
  suppliersById: Record<string, string>;
  locations: Option[];
  /** Last purchase cost (céntimos) per packaging id, to prefill. */
  lastCosts: Record<string, number>;
  /** Learned: normalized document text → packaging id. */
  aliases: Record<string, string>;
  aiEnabled: boolean;
  /** Known suppliers, suggested while typing. */
  supplierNames: string[];
  /** Prefill from a purchase list (spec 013): costs already include each line's freight. */
  initial?: { purchaseId: string; supplier: string; lines: { packagingId: string; quantity: number; unitCost: number }[] };
}) {
  const [state, action, pending] = useActionState(receiveGoods, undefined);
  const [products, setProducts] = useState(initialProducts);
  const [creating, setCreating] = useState<string | null>(null);
  const [type, setType] = useState<ReceiptType>("COMPRA");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [document, setDocument] = useState("");
  const [readTotal, setReadTotal] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>(() =>
    (initial?.lines ?? []).map((l) => ({
      key: `l${seq++}`,
      product: products.find((p) => p.packagings.some((x) => x.id === l.packagingId)) ?? null,
      packagingId: l.packagingId,
      quantity: String(l.quantity),
      unitCost: toSolesInput(l.unitCost),
      expiresOn: "",
      locationId: locations[0]?.id ?? "",
    })),
  );

  const costFor = (packagingId: string) => (lastCosts[packagingId] ? toSolesInput(lastCosts[packagingId]) : "");
  const lastLocation = (s: Line[]) => s.at(-1)?.locationId ?? locations[0]?.id ?? "";
  const add = (p: ReceivableProduct) => {
    const pack = largest(p);
    // Typed lines go on top, under the search (lines read from a document keep the document's order below).
    setLines((s) => [
      {
        key: `l${seq++}`,
        product: p,
        packagingId: pack.id,
        quantity: "1",
        unitCost: costFor(pack.id),
        expiresOn: "",
        locationId: s[0]?.locationId ?? lastLocation(s),
      },
      ...s,
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
    purchaseId: initial?.purchaseId,
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

  if (!locations.length) return <EmptyState text="Primero agrega un piso del almacén en Catálogo." />;

  return (
    <form action={action} className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <input type="hidden" name="data" value={data} />
      <datalist id="suppliers">
        {supplierNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {/* Desktop: the receipt card, total and save move together in one sticky right column. Phone: wrapper vanishes; order = card, lines, total. */}
      <div className="contents lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-3">
        <div className="tarjeta order-1 flex flex-col gap-3">
          <h2 className="titulo-tarjeta">¿Qué estás registrando?</h2>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["COMPRA", "Llegó mercadería", "una compra", ICONS.truck],
                ["SALDO_INICIAL", "Ya lo tengo", "inventario inicial", ICONS.box],
              ] as const
            ).map(([value, label, hint, icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                aria-pressed={type === value}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-sm font-semibold transition ${type === value ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(15,118,110,0.25)]" : "border-border bg-surface text-slate-700 hover:border-teal-300"}`}
              >
                <span className="flex items-center gap-1.5">
                  <Glyph d={icon} />
                  {label}
                </span>
                <span className={`text-xs font-normal ${type === value ? "text-teal-50" : "text-muted"}`}>{hint}</span>
              </button>
            ))}
          </div>
          {type === "COMPRA" && (
            <>
              <ReadDocumentButton onRead={addRead} aiEnabled={aiEnabled} />
              <div className="flex flex-col gap-3">
                <label className="campo-etiqueta">
                  Proveedor
                  <input
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    maxLength={80}
                    list="suppliers"
                    placeholder="Escribe o elige (si es nuevo, se crea)"
                  />
                </label>
                <label className="campo-etiqueta">
                  N° guía / factura
                  <input value={document} onChange={(e) => setDocument(e.target.value)} maxLength={80} placeholder="Opcional, ej. F001-123" />
                </label>
              </div>
            </>
          )}
        </div>
        {/* Phone: total and save stick above the bottom bar; desktop: right column, under the receipt card. */}
        <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-10 order-3 flex flex-col gap-3 lg:static">
          <div className="tarjeta flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">
                {lines.length} producto{lines.length === 1 ? "" : "s"}
              </span>
              <span className="cifra text-2xl text-primary">{formatSoles(total)}</span>
            </div>
            {readTotal !== null && (
              <p
                className={`rounded-lg px-2.5 py-1.5 text-sm ${readTotal === total ? "bg-emerald-50 text-emerald-800" : "bg-red-50 font-medium text-red-700"}`}
              >
                Total en el documento {formatSoles(readTotal)}
                {readTotal === total ? " · cuadra" : " · no cuadra, revisa"}
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
        </div>
      </div>

      <div className="order-2 flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
        {/* Search first; a product added by hand appears right under it. */}
        <div className="tarjeta p-3">
          <ProductPicker
            products={products}
            onPick={add}
            onCreate={setCreating}
            placeholder={lines.length ? "+ Agregar otro producto" : "Busca el producto que llegó"}
          />
        </div>
        {creating !== null && (
          <QuickProductPanel
            action={quickCreateProduct}
            categories={categories}
            supplierId={suppliersById[supplier.trim().toLowerCase()] ?? ""}
            initialName={creating}
            onClose={() => setCreating(null)}
            onCreated={({ product, packagingId, cost }) => {
              setProducts((l) => [...l, product]);
              setLines((s) => [
                {
                  key: `l${seq++}`,
                  product,
                  packagingId,
                  quantity: "1",
                  unitCost: toSolesInput(cost),
                  expiresOn: "",
                  locationId: s[0]?.locationId ?? lastLocation(s),
                },
                ...s,
              ]);
              setCreating(null);
            }}
          />
        )}
        {!lines.length && creating === null && (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="font-semibold">Aún no hay productos</p>
            <p className="max-w-sm text-sm text-muted">Búscalos arriba o toca «Leer factura» para cargarlos desde la foto o el PDF.</p>
          </div>
        )}
        {lines.length > 0 && (
          <p className="rotulo px-1">
            {lines.length} producto{lines.length === 1 ? "" : "s"} en este ingreso
          </p>
        )}
        {lines.map((l) => {
          const p = l.product;
          const pack = p?.packagings.find((x) => x.id === l.packagingId);
          return (
            <div key={l.key} className={`tarjeta flex flex-col gap-3 ${l.status && l.status !== "alias" ? "border-amber-300" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <Avatar name={p ? p.name : "?"} tone={p ? undefined : "bg-red-100 text-red-700"} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="font-semibold leading-tight">{p ? p.name : "Producto no encontrado"}</p>
                  {l.readText && (
                    <p className="text-xs text-muted">
                      Leído: {l.readText}{" "}
                      {l.status && (
                        <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS[l.status].className}`}>{STATUS[l.status].label}</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLines((s) => s.filter((x) => x.key !== l.key))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
                  aria-label="Quitar"
                >
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
              {p && (
                <p className="flex items-baseline justify-end gap-2 border-t border-slate-100 pt-2 text-sm text-muted">
                  Subtotal <span className="cifra text-base text-foreground">{formatSoles(subtotal(l))}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </form>
  );
}
