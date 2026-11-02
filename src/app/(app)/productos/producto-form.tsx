"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { guardarProducto } from "./actions";

type Opcion = { id: string; nombre: string };
type Pres = { key: string; id?: string; nombre: string; factor: string; precio: string; codigoBarras: string };
export type ProductoInicial = {
  id?: string;
  sku: string;
  nombre: string;
  categoriaId: string;
  marcaId: string;
  stockMinimo: number;
  margenPct: number;
  presentaciones: Omit<Pres, "key">[];
};

let n = 0;
const nuevaKey = () => `k${n++}`;

export function ProductoForm({ inicial, categorias, marcas }: { inicial: ProductoInicial; categorias: Opcion[]; marcas: Opcion[] }) {
  const [estado, accion, enviando] = useActionState(guardarProducto, undefined);
  const [p, setP] = useState(inicial);
  const [pres, setPres] = useState<Pres[]>(() => inicial.presentaciones.map((x) => ({ ...x, key: nuevaKey() })));

  const set = <K extends keyof ProductoInicial>(k: K, v: ProductoInicial[K]) => setP((s) => ({ ...s, [k]: v }));
  const setPresCampo = (i: number, campo: keyof Omit<Pres, "key" | "id">, v: string) =>
    setPres((s) => s.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));

  const datos = JSON.stringify({
    ...p,
    id: p.id || undefined,
    marcaId: p.marcaId || null,
    presentaciones: pres.map((x) => ({ id: x.id, nombre: x.nombre, factor: x.factor, precio: x.precio, codigoBarras: x.codigoBarras })),
  });

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="datos" value={datos} />

      <div className="tarjeta flex flex-col gap-3">
        <label className="campo">
          Nombre
          <input value={p.nombre} onChange={(e) => set("nombre", e.target.value)} required placeholder="Galleta Soda Field 34g" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="campo">
            Código interno
            <input value={p.sku} onChange={(e) => set("sku", e.target.value)} required placeholder="GAL-001" />
          </label>
          <label className="campo">
            Stock mínimo ({pres[0]?.nombre || "unidad"})
            <input type="number" min={0} inputMode="numeric" value={p.stockMinimo} onChange={(e) => set("stockMinimo", Number(e.target.value))} />
          </label>
          <label className="campo">
            Categoría
            <select value={p.categoriaId} onChange={(e) => set("categoriaId", e.target.value)} required>
              <option value="">Elegir…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Marca
            <select value={p.marcaId} onChange={(e) => set("marcaId", e.target.value)}>
              <option value="">Sin marca</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Margen sugerido %
            <input type="number" min={0} max={300} inputMode="numeric" value={p.margenPct} onChange={(e) => set("margenPct", Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="tarjeta flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Presentaciones y precios</h2>
          <p className="text-xs text-muted">
            La primera es la unidad más chica. Las demás dicen cuántas unidades traen (display = 12, caja = 144…).
          </p>
        </div>
        {pres.map((x, i) => (
          <div key={x.key} className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2 border-b border-border pb-3 last:border-0">
            <label className="campo">
              {i === 0 ? "Unidad base" : "Presentación"}
              <input value={x.nombre} onChange={(e) => setPresCampo(i, "nombre", e.target.value)} required placeholder={i === 0 ? "paquete" : "caja"} />
            </label>
            <label className="campo">
              Trae
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={i === 0 ? "1" : x.factor}
                disabled={i === 0}
                onChange={(e) => setPresCampo(i, "factor", e.target.value)}
                required
              />
            </label>
            <label className="campo">
              Precio S/
              <input inputMode="decimal" value={x.precio} onChange={(e) => setPresCampo(i, "precio", e.target.value)} required placeholder="0.50" />
            </label>
            {i === 0 ? (
              <span className="w-10" />
            ) : (
              <button type="button" onClick={() => setPres((s) => s.filter((_, j) => j !== i))} className="btn-secundario h-12 w-10 px-0" aria-label="Quitar">
                ✕
              </button>
            )}
            <label className="campo col-span-4">
              <span className="text-xs text-muted">Código de barras (opcional)</span>
              <input value={x.codigoBarras} onChange={(e) => setPresCampo(i, "codigoBarras", e.target.value)} inputMode="numeric" />
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPres((s) => [...s, { key: nuevaKey(), nombre: "", factor: "", precio: "", codigoBarras: "" }])}
          className="btn-secundario h-10 text-sm"
        >
          + Agregar presentación
        </button>
      </div>

      <p role="alert" className="min-h-5 text-sm text-red-600">
        {estado?.error}
      </p>
      <div className="flex gap-2">
        <Link href="/productos" className="btn-secundario flex h-12 flex-1 items-center justify-center">
          Cancelar
        </Link>
        <button disabled={enviando} className="btn-primario h-12 flex-1">
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
