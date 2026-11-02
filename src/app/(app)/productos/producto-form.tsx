"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { guardarProducto } from "./actions";
import { formatSoles, parseSoles } from "@/lib/dinero";

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

const UNIDADES = ["unidad", "paquete", "bolsa", "botella", "lata", "barra", "sachet", "pote", "sobre"];
const EMPAQUES = ["caja", "display", "fardo", "bulto", "pack", "tira", "docena", "paquete"];

let n = 0;
const nuevaKey = () => `k${n++}`;

export function ProductoForm({ inicial, categorias, marcas }: { inicial: ProductoInicial; categorias: Opcion[]; marcas: Opcion[] }) {
  const [estado, accion, enviando] = useActionState(guardarProducto, undefined);
  const [p, setP] = useState(inicial);
  const [pres, setPres] = useState<Pres[]>(() => inicial.presentaciones.map((x) => ({ ...x, key: nuevaKey() })));

  const set = <K extends keyof ProductoInicial>(k: K, v: ProductoInicial[K]) => setP((s) => ({ ...s, [k]: v }));
  const setPres_ = (i: number, campo: "nombre" | "factor" | "precio", v: string) =>
    setPres((s) => s.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));

  const [base, ...empaques] = pres;
  const unidad = base.nombre || "unidad";

  const datos = JSON.stringify({
    ...p,
    id: p.id || undefined,
    marcaId: p.marcaId || null,
    presentaciones: pres.map((x, i) => ({ id: x.id, nombre: x.nombre, factor: i === 0 ? "1" : x.factor, precio: x.precio, codigoBarras: x.codigoBarras })),
  });

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="datos" value={datos} />
      <datalist id="unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
      <datalist id="empaques">{EMPAQUES.map((u) => <option key={u} value={u} />)}</datalist>

      <div className="tarjeta flex flex-col gap-3">
        <label className="campo">
          Nombre del producto
          <input value={p.nombre} onChange={(e) => set("nombre", e.target.value)} required placeholder="Ej. Galleta Soda Field 34g" autoFocus={!p.id} />
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
        <div className="grid grid-cols-2 gap-3">
          <label className="campo">
            Se vende por
            <input list="unidades" value={base.nombre} onChange={(e) => setPres_(0, "nombre", e.target.value)} required />
          </label>
          <label className="campo">
            Precio S/
            <input inputMode="decimal" value={base.precio} onChange={(e) => setPres_(0, "precio", e.target.value)} required placeholder="0.50" />
          </label>
        </div>
      </div>

      <div className="tarjeta flex flex-col gap-3">
        <p className="text-sm font-medium">¿También lo vendes por caja, display o fardo?</p>
        {empaques.map((x, k) => {
          const i = k + 1;
          const precio = parseSoles(x.precio);
          const factor = Number(x.factor);
          return (
            <div key={x.key} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  list="empaques"
                  value={x.nombre}
                  onChange={(e) => setPres_(i, "nombre", e.target.value)}
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
                  onChange={(e) => setPres_(i, "factor", e.target.value)}
                  required
                  aria-label={`Cuántas ${unidad} trae`}
                  className="h-11 w-16 rounded-xl border border-border bg-surface px-2"
                />
                <span className="truncate">{unidad}</span>
                <span>a S/</span>
                <input
                  inputMode="decimal"
                  value={x.precio}
                  onChange={(e) => setPres_(i, "precio", e.target.value)}
                  required
                  aria-label="Precio"
                  className="h-11 w-20 min-w-0 rounded-xl border border-border bg-surface px-2"
                />
                <button type="button" onClick={() => setPres((s) => s.filter((_, j) => j !== i))} className="ml-auto text-muted" aria-label="Quitar">
                  ✕
                </button>
              </div>
              {precio !== null && factor > 1 && (
                <p className="text-xs text-muted">
                  Sale a {formatSoles(Math.round(precio / factor))} por {unidad}
                </p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setPres((s) => [...s, { key: nuevaKey(), nombre: "caja", factor: "", precio: "", codigoBarras: "" }])}
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
            Código
            <input value={p.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Automático" />
          </label>
          <label className="campo">
            Avisar si quedan menos de ({unidad})
            <input type="number" min={0} inputMode="numeric" value={p.stockMinimo} onChange={(e) => set("stockMinimo", Number(e.target.value))} />
          </label>
          <label className="campo">
            Ganancia que quiero %
            <input type="number" min={0} max={300} inputMode="numeric" value={p.margenPct} onChange={(e) => set("margenPct", Number(e.target.value))} />
          </label>
        </div>
      </details>

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
