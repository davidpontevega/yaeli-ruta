"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { formatSoles, parseSoles } from "@/lib/money";
import { saveProduct } from "../actions";
import type { CatalogOption } from "../queries";

type PackagingDraft = { key: string; id?: string; name: string; factor: string; price: string; barcode: string };
export type ProductDraft = {
  id?: string;
  sku: string;
  name: string;
  categoryId: string;
  brandId: string;
  minStock: number;
  marginPct: number;
  packagings: Omit<PackagingDraft, "key">[];
};

const UNITS = ["unidad", "paquete", "bolsa", "botella", "lata", "barra", "sachet", "pote", "sobre"];
const PACKS = ["caja", "display", "fardo", "bulto", "pack", "tira", "docena", "paquete"];

let seq = 0;
const newKey = () => `k${seq++}`;

export function ProductForm({ initial, categories, brands }: { initial: ProductDraft; categories: CatalogOption[]; brands: CatalogOption[] }) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const [p, setP] = useState(initial);
  const [packs, setPacks] = useState<PackagingDraft[]>(() => initial.packagings.map((x) => ({ ...x, key: newKey() })));

  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setP((s) => ({ ...s, [k]: v }));
  const setPack = (i: number, field: "name" | "factor" | "price", v: string) =>
    setPacks((s) => s.map((x, j) => (j === i ? { ...x, [field]: v } : x)));

  const [base, ...larger] = packs;
  const unit = base.name || "unidad";

  const data = JSON.stringify({
    ...p,
    id: p.id || undefined,
    brandId: p.brandId || null,
    packagings: packs.map((x, i) => ({ id: x.id, name: x.name, factor: i === 0 ? "1" : x.factor, price: x.price, barcode: x.barcode })),
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="data" value={data} />
      <datalist id="units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="packs">
        {PACKS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="tarjeta flex flex-col gap-3">
        <label className="campo">
          Nombre del producto
          <input value={p.name} onChange={(e) => set("name", e.target.value)} required placeholder="Ej. Galleta Soda Field 34g" autoFocus={!p.id} />
        </label>
        <label className="campo">
          Categoría
          <select value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
            <option value="">Elegir…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="campo">
            Se vende por
            <input list="units" value={base.name} onChange={(e) => setPack(0, "name", e.target.value)} required />
          </label>
          <label className="campo">
            Precio S/
            <input inputMode="decimal" value={base.price} onChange={(e) => setPack(0, "price", e.target.value)} required placeholder="0.50" />
          </label>
        </div>
      </div>

      <div className="tarjeta flex flex-col gap-3">
        <p className="text-sm font-medium">¿También lo vendes por caja, display o fardo?</p>
        {larger.map((x, k) => {
          const i = k + 1;
          const price = parseSoles(x.price);
          const factor = Number(x.factor);
          return (
            <div key={x.key} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  list="packs"
                  value={x.name}
                  onChange={(e) => setPack(i, "name", e.target.value)}
                  required
                  placeholder="caja"
                  aria-label="Empaque"
                  className="h-11 w-24 rounded-xl border border-border bg-surface px-2"
                />
                <span>de</span>
                <input
                  type="number"
                  min={2}
                  inputMode="numeric"
                  value={x.factor}
                  onChange={(e) => setPack(i, "factor", e.target.value)}
                  required
                  aria-label={`Cuántas ${unit} trae`}
                  className="h-11 w-16 rounded-xl border border-border bg-surface px-2"
                />
                <span className="truncate">{unit}</span>
                <span>a S/</span>
                <input
                  inputMode="decimal"
                  value={x.price}
                  onChange={(e) => setPack(i, "price", e.target.value)}
                  required
                  aria-label="Precio"
                  className="h-11 w-20 min-w-0 rounded-xl border border-border bg-surface px-2"
                />
                <button type="button" onClick={() => setPacks((s) => s.filter((_, j) => j !== i))} className="ml-auto text-muted" aria-label="Quitar">
                  ✕
                </button>
              </div>
              {price !== null && factor > 1 && (
                <p className="text-xs text-muted">
                  Sale a {formatSoles(Math.round(price / factor))} por {unit}
                </p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setPacks((s) => [...s, { key: newKey(), name: "caja", factor: "", price: "", barcode: "" }])}
          className="btn-secundario h-10 text-sm"
        >
          + Agregar caja / display
        </button>
      </div>

      <details className="tarjeta">
        <summary className="cursor-pointer text-sm font-medium">Más opciones (no obligatorio)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="campo">
            Marca
            <select value={p.brandId} onChange={(e) => set("brandId", e.target.value)}>
              <option value="">Sin marca</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Código
            <input value={p.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Automático" />
          </label>
          <label className="campo">
            Avisar si quedan menos de ({unit})
            <input type="number" min={0} inputMode="numeric" value={p.minStock} onChange={(e) => set("minStock", Number(e.target.value))} />
          </label>
          <label className="campo">
            Ganancia que quiero %
            <input type="number" min={0} max={300} inputMode="numeric" value={p.marginPct} onChange={(e) => set("marginPct", Number(e.target.value))} />
          </label>
        </div>
      </details>

      <p role="alert" className="min-h-5 text-sm text-red-600">
        {state?.error}
      </p>
      <div className="flex gap-2">
        <Link href="/productos" className="btn-secundario flex h-12 flex-1 items-center justify-center">
          Cancelar
        </Link>
        <button disabled={pending} className="btn-primario h-12 flex-1">
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
