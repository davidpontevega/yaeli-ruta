"use client";

import { useState, useTransition } from "react";

type Packaging = { id: string; name: string; factor: number; salePrice: number; weightGrams: number | null };
export type QuickProduct = { id: string; name: string; sku: string; active: boolean; supplierId: string | null; packagings: Packaging[] };
type Result = { error?: string; product?: QuickProduct; cost?: number; packagingId?: string };

/**
 * Create a product that isn't in the catalog yet, without leaving the purchase or receipt. Not a <form> (it sits inside
 * one): the button calls the server action passed by the page. Prices start at 15% over the cost; edit later in Productos.
 */
export function QuickProductPanel({
  action,
  categories,
  supplierId,
  initialName,
  onCreated,
  onClose,
}: {
  action: (state: Result | undefined, form: FormData) => Promise<Result>;
  categories: { id: string; name: string }[];
  supplierId: string;
  initialName: string;
  onCreated: (r: { product: QuickProduct; packagingId: string; cost: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [packName, setPackName] = useState("caja");
  const [packFactor, setPackFactor] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const hasPack = Number(packFactor) >= 2;

  const save = () =>
    start(async () => {
      const fd = new FormData();
      Object.entries({ name, categoryId, unit, packName: hasPack ? packName : "", packFactor: hasPack ? packFactor : "0", cost, supplierId }).forEach(
        ([k, v]) => fd.set(k, v),
      );
      const r = await action(undefined, fd);
      if (r.error || !r.product) return setError(r.error ?? "No se pudo crear");
      onCreated({ product: r.product, packagingId: r.packagingId!, cost: r.cost! });
    });

  const field = "h-11 rounded-xl border border-border bg-surface px-3 text-base";
  return (
    <div className="tarjeta flex flex-col gap-3 border-teal-300 ring-2 ring-teal-100">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">Nuevo producto</h3>
        <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-sm font-medium text-muted hover:bg-slate-100">
          Cancelar
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
          Categoría
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="">Elige…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
          Se vende por
          <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={40} placeholder="unidad, bolsa…" className={field} />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          Viene en (opcional)
          <div className="flex items-center gap-2">
            <input value={packName} onChange={(e) => setPackName(e.target.value)} maxLength={40} aria-label="Empaque" className={`${field} w-28`} />
            <span className="font-normal">de</span>
            <input
              type="number"
              min={2}
              inputMode="numeric"
              value={packFactor}
              onChange={(e) => setPackFactor(e.target.value)}
              placeholder="12"
              aria-label={`Cuántas ${unit} trae`}
              className={`${field} w-20`}
            />
            <span className="truncate font-normal">{unit}</span>
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          Costo S/ por {hasPack ? packName || "caja" : unit || "unidad"}
          <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className={field} />
          <span className="text-xs font-normal text-muted">El precio de venta sale con 15% de ganancia; lo ajustas luego en Productos.</span>
        </label>
      </div>
      <button type="button" onClick={save} disabled={pending || name.trim().length < 2 || !categoryId || !cost} className="btn-primario h-11 text-sm">
        {pending ? "Creando…" : "Crear y agregar a la lista"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
