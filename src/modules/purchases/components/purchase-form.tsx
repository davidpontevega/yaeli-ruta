"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ProductPicker } from "@/components/ui/product-picker";
import { SupplierQuickAdd } from "@/components/ui/supplier-quick-add";
import { QuickProductPanel, type QuickProduct } from "@/components/ui/quick-product";
import { formatSoles, parseSoles, toSolesInput } from "@/lib/money";
import { formatKg } from "@/lib/weight";
import { cancelPurchase, savePurchase } from "../actions";
import { lineWeight, purchaseTotals } from "../purchase-math";
import { ICONS, IconTile } from "@/components/ui/avatar";
import type { PurchaseType } from "@/server/db/schema";

type Packaging = { id: string; name: string; factor: number; weightGrams: number | null };
type Product = { id: string; name: string; sku: string; active: boolean; supplierId: string | null; packagings: Packaging[] };
type Option = { id: string; name: string };
type SupplierAction = (
  state: { error?: string; ok?: string; id?: string; name?: string } | undefined,
  form: FormData,
) => Promise<{ error?: string; ok?: string; id?: string; name?: string }>;
type Vehicle = Option & { capacityKg: number | null };
type Draft = { packagingId: string; quantity: string; cost: string; freight: string };

const TYPES = [
  ["ENVIA_PROVEEDOR", "Envía proveedor"],
  ["RECOJO", "Voy con mi camión"],
] as const;

type QuickResult = { error?: string; product?: QuickProduct; cost?: number; packagingId?: string };

export function PurchaseForm({
  products: initialProducts,
  categories,
  quickCreateProduct,
  suppliers: initialSuppliers,
  vehicles,
  createSupplier,
  costs,
  missing,
  initial,
  editable,
}: {
  products: Product[];
  /** For creating a missing product from here (with `quickCreateProduct`, a server action the page passes). */
  categories: Option[];
  quickCreateProduct: (state: QuickResult | undefined, form: FormData) => Promise<QuickResult>;
  suppliers: Option[];
  /** Server action to add a supplier from here (the page passes it). */
  createSupplier: SupplierAction;
  vehicles: Vehicle[];
  /** Cost to prefill per packaging (céntimos). */
  costs: Record<string, number>;
  /** What each supplier's low products need, in their biggest packaging. */
  missing: { supplierId: string; packagingId: string; quantity: number }[];
  initial: {
    id?: string;
    number?: number;
    type: PurchaseType;
    supplierId: string;
    vehicleId: string;
    lines: { packagingId: string; quantity: number; cost: number; freight: number }[];
  };
  /** false: received or cancelled, shown read-only. */
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(savePurchase, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelPurchase, undefined);
  const [type, setType] = useState<PurchaseType>(initial.type);
  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [supplierList, setSupplierList] = useState(initialSuppliers);
  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const [lines, setLines] = useState<Draft[]>(
    initial.lines.map((l) => ({
      packagingId: l.packagingId,
      quantity: String(l.quantity),
      cost: toSolesInput(l.cost),
      freight: l.freight ? toSolesInput(l.freight) : "",
    })),
  );

  const [products, setProducts] = useState(initialProducts);
  const [creating, setCreating] = useState<string | null>(null);
  const byPackaging = new Map(products.flatMap((p) => p.packagings.map((x) => [x.id, { product: p, packaging: x }] as const)));
  const known = lines.filter((l) => byPackaging.has(l.packagingId));
  const recojo = type === "RECOJO";
  const num = (l: Draft) => ({
    quantity: Math.trunc(Number(l.quantity)) || 0,
    cost: parseSoles(l.cost) ?? -1, // invalid → rejected by the server with a message
    freight: recojo ? (l.freight.trim() ? (parseSoles(l.freight) ?? -1) : 0) : 0,
    weightGrams: byPackaging.get(l.packagingId)!.packaging.weightGrams,
  });
  const totals = purchaseTotals(known.map((l) => ({ ...num(l), cost: Math.max(0, num(l).cost), freight: Math.max(0, num(l).freight) })));
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const capacity = recojo && vehicle?.capacityKg ? vehicle.capacityKg * 1000 : null;

  const addLine = (packagingId: string, quantity: number) =>
    setLines((ls) =>
      ls.some((l) => l.packagingId === packagingId)
        ? ls
        : [...ls, { packagingId, quantity: String(quantity), cost: costs[packagingId] ? toSolesInput(costs[packagingId]) : "", freight: "" }],
    );
  const add = (p: Product) => addLine(p.packagings.reduce((a, b) => (b.factor > a.factor ? b : a)).id, 1);
  const addMissing = () => missing.filter((m) => m.supplierId === supplierId).forEach((m) => addLine(m.packagingId, m.quantity));
  const update = (packagingId: string, patch: Partial<Draft>) =>
    setLines((ls) => ls.map((l) => (l.packagingId === packagingId ? { ...l, ...patch } : l)));

  const data = JSON.stringify({
    id: initial.id,
    type,
    supplierId: supplierId || null,
    vehicleId: recojo ? vehicleId || null : null,
    lines: known.map((l) => ({ packagingId: l.packagingId, ...num(l), weightGrams: undefined })),
  });

  // WhatsApp text: to the supplier without costs; for the owner's own trip, with weight and cost.
  const shareText = [
    `Pedido${initial.number ? ` #${initial.number}` : ""} — Distribuidora Yaeli`,
    ...known.map((l) => {
      const { product, packaging } = byPackaging.get(l.packagingId)!;
      const base = `${l.quantity} ${packaging.name} · ${product.name}`;
      if (!recojo) return base;
      const w = lineWeight(num(l));
      return `${base}${w ? ` · ${formatKg(w)}` : ""} · ${formatSoles(num(l).quantity * Math.max(0, num(l).cost))}`;
    }),
    ...(recojo ? [`Peso ${formatKg(totals.weight)} · Flete ${formatSoles(totals.freight)} · Total ${formatSoles(totals.total)}`] : []),
  ].join("\n");

  return (
    // Phone: totals, list, actions in one column. Desktop: the list on the left; totals and actions on the right.
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      {/* Desktop: summary and actions move together in one sticky column. Phone: the wrapper vanishes (contents) and order puts the summary on top, actions at the end. */}
      <div className="contents lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-3">
        {/* Totals stay visible while scrolling the lines. */}
        <div className="tarjeta sticky top-14 z-10 order-1 flex flex-col gap-1 text-sm md:top-4 lg:static print:static">
          <h2 className="titulo-tarjeta text-sm">
            <IconTile d={recojo ? ICONS.truck : ICONS.box} tone={recojo ? "bg-sky-50 text-sky-700" : "bg-teal-50 text-teal-700"} />
            Resumen de la compra
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <span className="block text-[11px] font-medium text-muted">Peso{capacity ? ` / ${formatKg(capacity)}` : ""}</span>
              <span className={`cifra text-lg ${capacity && totals.weight > capacity ? "text-red-700" : ""}`}>{formatKg(totals.weight)}</span>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <span className="block text-[11px] font-medium text-muted">Mercadería</span>
              <span className="cifra text-lg">{formatSoles(totals.goods)}</span>
            </div>
            {recojo && (
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="block text-[11px] font-medium text-muted">Flete</span>
                <span className="cifra text-lg">{formatSoles(totals.freight)}</span>
              </div>
            )}
            <div className={`rounded-xl bg-teal-50 px-3 py-2 ${recojo ? "" : "col-span-2"}`}>
              <span className="block text-[11px] font-medium text-teal-800">Total</span>
              <span className="cifra text-lg text-primary">{formatSoles(totals.total)}</span>
            </div>
          </div>
          {capacity && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div
                className={`h-full ${totals.weight > capacity ? "bg-red-600" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (totals.weight * 100) / capacity)}%` }}
              />
            </div>
          )}
          {capacity && totals.weight > capacity && <p className="font-semibold text-red-600">Se pasa de la carga del vehículo</p>}
          {totals.noWeight > 0 && <p className="text-xs text-amber-700">{totals.noWeight} producto(s) sin peso: complétalo en Productos.</p>}
          {/* Save lives in the summary, which stays in view: no scrolling to the end of a long list. */}
          {editable && (
            <button form="purchase-form" disabled={pending || !known.length} className="btn-primario mt-1 h-12 print:hidden">
              {initial.id ? "Guardar cambios" : "Guardar lista"} · {known.length} producto{known.length === 1 ? "" : "s"}
            </button>
          )}
          {state?.error && <p className="text-sm text-red-600 print:hidden">{state.error}</p>}
        </div>
        <div className="order-3 flex flex-col gap-3 print:hidden">
          {initial.id && known.length > 0 && (
            <div className="grid grid-cols-2 gap-2 print:hidden">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secundario flex h-12 items-center justify-center text-sm"
              >
                Enviar por WhatsApp
              </a>
              <button type="button" onClick={() => window.print()} className="btn-secundario h-12 text-sm">
                Imprimir
              </button>
            </div>
          )}
          {initial.id && editable && (
            <Link href={`/recepciones/nueva?compra=${initial.id}`} className="btn-primario flex h-12 items-center justify-center print:hidden">
              Recibir esta compra
            </Link>
          )}
          {initial.id && editable && (
            <form action={cancelAction} onSubmit={(e) => !confirm("¿Anular esta compra?") && e.preventDefault()} className="print:hidden">
              <input type="hidden" name="id" value={initial.id} />
              <button disabled={cancelling} className="h-12 w-full rounded-xl border border-red-300 text-red-600">
                Anular compra
              </button>
              {cancelState?.error && <p className="text-sm text-red-600">{cancelState.error}</p>}
            </form>
          )}
        </div>
      </div>

      <form id="purchase-form" action={action} className="order-2 flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1 print:hidden">
        <input type="hidden" name="data" value={data} />
        <fieldset disabled={!editable} className="flex flex-col gap-3">
          <div className="tarjeta flex flex-col gap-3">
            <h2 className="titulo-tarjeta">¿Cómo vas a comprar?</h2>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={`flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${type === v ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(15,118,110,0.25)]" : "border-border bg-surface text-slate-700 hover:border-teal-300"}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={v === "RECOJO" ? ICONS.truck : ICONS.box} />
                  </svg>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                aria-label="Proveedor"
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
              >
                <option value="">{recojo ? "Varios proveedores" : "Elige el proveedor"}</option>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {editable && (
                <SupplierQuickAdd
                  action={createSupplier}
                  onCreated={(c) => {
                    setSupplierList((l) => (l.some((x) => x.id === c.id) ? l : [...l, c].sort((a, b) => a.name.localeCompare(b.name))));
                    setSupplierId(c.id);
                  }}
                />
              )}
              {recojo && (
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  aria-label="Vehículo"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3"
                >
                  <option value="">Vehículo…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.capacityKg ? ` (${v.capacityKg} kg)` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {supplierId && editable && (
              <button type="button" onClick={addMissing} className="btn-suave h-12 justify-center">
                Agregar lo que falta de este proveedor
              </button>
            )}
          </div>

          {/* Search first and newest line on top, so what you just added stays in view. */}
          {editable && (
            <div className="tarjeta p-3">
              <ProductPicker
                products={products.filter((p) => p.active)}
                onPick={add}
                onCreate={setCreating}
                placeholder={known.length ? "+ Agregar otro producto" : "Busca el producto"}
              />
            </div>
          )}
          {editable && creating !== null && (
            <QuickProductPanel
              action={quickCreateProduct}
              categories={categories}
              supplierId={supplierId}
              initialName={creating}
              onClose={() => setCreating(null)}
              onCreated={({ product, packagingId, cost }) => {
                setProducts((l) => [...l, product]);
                setLines((ls) => [...ls, { packagingId, quantity: "1", cost: toSolesInput(cost), freight: "" }]);
                setCreating(null);
              }}
            />
          )}
          {editable && !known.length && (
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-8 text-center">
              <p className="font-semibold">Tu lista está vacía</p>
              <p className="max-w-sm text-sm text-muted">
                Busca productos arriba
                {supplierId ? " o toca «Agregar lo que falta de este proveedor»" : ", o elige un proveedor para agregar lo que le falta"}.
              </p>
            </div>
          )}
          {[...known].reverse().map((l) => {
            const { product } = byPackaging.get(l.packagingId)!;
            const n = num(l);
            const w = lineWeight(n);
            return (
              <div key={l.packagingId} className="tarjeta flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">
                    {product.name}
                    {!product.active && <span className="ml-2 text-xs font-semibold text-red-600">inactivo: quítalo para guardar</span>}
                  </p>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((x) => x.packagingId !== l.packagingId))}
                      className="text-sm text-red-600"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => update(l.packagingId, { quantity: e.target.value })}
                    aria-label="Cantidad"
                    className="h-10 w-20 rounded-xl border border-border bg-surface px-3"
                  />
                  <select
                    value={l.packagingId}
                    onChange={(e) =>
                      !lines.some((x) => x.packagingId === e.target.value) &&
                      update(l.packagingId, { packagingId: e.target.value, cost: costs[e.target.value] ? toSolesInput(costs[e.target.value]) : "" })
                    }
                    aria-label="Presentación"
                    className="h-10 rounded-xl border border-border bg-surface px-2"
                  >
                    {product.packagings.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                        {x.factor > 1 ? ` ×${x.factor}` : ""}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1">
                    S/
                    <input
                      inputMode="decimal"
                      value={l.cost}
                      onChange={(e) => update(l.packagingId, { cost: e.target.value })}
                      aria-label="Costo por presentación"
                      placeholder="costo"
                      className="h-10 w-24 rounded-xl border border-border bg-surface px-3"
                    />
                  </label>
                  {recojo && (
                    <label className="flex items-center gap-1">
                      Flete S/
                      <input
                        inputMode="decimal"
                        value={l.freight}
                        onChange={(e) => update(l.packagingId, { freight: e.target.value })}
                        aria-label="Flete de la línea"
                        placeholder="0"
                        className="h-10 w-20 rounded-xl border border-border bg-surface px-3"
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {w === null ? "sin peso" : formatKg(w)} · {formatSoles(n.quantity * Math.max(0, n.cost))}
                </p>
              </div>
            );
          })}
        </fieldset>
      </form>

      {/* Paper version: the notebook sheet. */}
      <table className="order-4 hidden w-full text-sm lg:col-span-2 print:table">
        <thead>
          <tr className="border-b text-left">
            <th>Cant.</th>
            <th>Producto</th>
            <th className="text-right">Peso</th>
            {recojo && <th className="text-right">Flete</th>}
            <th className="text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          {known.map((l) => {
            const { product, packaging } = byPackaging.get(l.packagingId)!;
            const n = num(l);
            const w = lineWeight(n);
            return (
              <tr key={l.packagingId} className="border-b">
                <td>
                  {l.quantity} {packaging.name}
                </td>
                <td>{product.name}</td>
                <td className="text-right">{w === null ? "" : formatKg(w)}</td>
                {recojo && <td className="text-right">{n.freight ? formatSoles(n.freight) : ""}</td>}
                <td className="text-right">{formatSoles(n.quantity * Math.max(0, n.cost))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
