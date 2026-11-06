"use client";

import { useState } from "react";

const MAX_RESULTS = 8;

/** Search box over an in-memory product list; tapping a result calls `onPick`. */
export function ProductPicker<P extends { id: string; name: string; sku: string }>({
  products,
  onPick,
  placeholder,
}: {
  products: P[];
  onPick: (p: P) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const results =
    term.length < 2 ? [] : products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)).slice(0, MAX_RESULTS);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar producto"
        className="h-12 rounded-xl border border-border bg-surface px-3"
      />
      {results.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            onPick(p);
            setQ("");
          }}
          className="rounded-xl border border-border px-3 py-2 text-left text-sm active:bg-slate-100"
        >
          {p.name} <span className="text-muted">· {p.sku}</span>
        </button>
      ))}
      {term.length >= 2 && !results.length && <p className="text-sm text-muted">No se encontró. Créalo primero en Productos.</p>}
    </div>
  );
}
