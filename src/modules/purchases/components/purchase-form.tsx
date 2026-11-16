"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ProductPicker } from "@/components/ui/product-picker";
import { formatSoles, parseSoles, toSolesInput } from "@/lib/money";
import { formatKg } from "@/lib/weight";
import { cancelPurchase, savePurchase } from "../actions";
import { lineWeight, purchaseTotals } from "../purchase-math";
import type { PurchaseType } from "@/server/db/schema";

type Packaging = { id: string; name: string; factor: number; weightGrams: number | null };
type Product = { id: string; name: string; sku: string; active: boolean; supplierId: string | null; packagings: Packaging[] };
type Option = { id: string; name: string };
type Vehicle = Option & { capacityKg: number | null };
type Draft = { packagingId: string; quantity: string; cost: string; freight: string };

const TYPES = [
  ["ENVIA_PROVEEDOR", "Envía proveedor"],
  ["RECOJO", "Voy con mi camión"],
] as const;

export function PurchaseForm({
  products,
  suppliers,
  vehicles,
  costs,
  missing,
  initial,
  editable,
}: {
  products: Product[];
  suppliers: Option[];
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
  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const [lines, setLines] = useState<Draft[]>(
    initial.lines.map((l) => ({
      packagingId: l.packagingId,
      quantity: String(l.quantity),
      cost: toSolesInput(l.cost),
      freight: l.freight ? toSolesInput(l.freight) : "",
    })),
  );

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
    <div className="flex flex-col gap-3">
      {/* Totals stay visible while scrolling the lines. */}
      <div className="tarjeta sticky top-14 z-10 md:top-4 flex flex-col gap-1 text-sm print:static">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <span>
            Peso <b className="cifra">{formatKg(totals.weight)}</b>
            {capacity && ` / ${formatKg(capacity)}`}
          </span>
          <span>
            Mercadería <b>{formatSoles(totals.goods)}</b>
          </span>
          {recojo && (
            <span>
              Flete <b>{formatSoles(totals.freight)}</b>
            </span>
          )}
          <span>
            Total <b className="cifra text-primary">{formatSoles(totals.total)}</b>
          </span>
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
      </div>

      <form action={action} className="flex flex-col gap-3 print:hidden">
        <input type="hidden" name="data" value={data} />
        <fieldset disabled={!editable} className="flex flex-col gap-3">
          <div className="tarjeta flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={`h-12 rounded-xl border text-sm font-medium ${type === v ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
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
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
              <button type="button" onClick={addMissing} className="btn-secundario h-12">
                Agregar lo que falta de este proveedor
              </button>
            )}
          </div>

          {known.map((l) => {
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

          {editable && (
            <ProductPicker
              products={products.filter((p) => p.active)}
              onPick={add}
              placeholder={known.length ? "+ Agregar otro producto" : "Busca el producto"}
            />
          )}
        </fieldset>

        {editable && (
          <button disabled={pending || !known.length} className="btn-primario h-12">
            {initial.id ? "Guardar cambios" : "Guardar lista"}
          </button>
        )}
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>

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

      {/* Paper version: the notebook sheet. */}
      <table className="hidden w-full text-sm print:table">
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
