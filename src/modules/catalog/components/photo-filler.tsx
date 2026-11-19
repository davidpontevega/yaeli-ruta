"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductPhoto } from "./product-photo";

/** Products without a photo, one at a time; saving or skipping moves to the next. */
export function PhotoFiller({ products }: { products: { id: string; name: string; category: string }[] }) {
  // Snapshot: saving revalidates the page and the server list shrinks, which would shift the index.
  const [list] = useState(products);
  const [i, setI] = useState(0);
  const p = list[i];
  if (!p) return <EmptyState text="Todos tienen foto." tone="bg-emerald-50 text-emerald-600" />;
  const next = () => setI((n) => n + 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{p.name}</p>
          <p className="text-sm text-muted">{p.category}</p>
        </div>
        <span className="chip shrink-0 bg-slate-100 text-slate-700">
          {i + 1} de {list.length}
        </span>
      </div>
      <ProductPhoto key={p.id} productId={p.id} name={p.name} photoVersion={null} onSaved={next} />
      <button type="button" onClick={next} className="btn-secundario h-12">
        Saltar
      </button>
    </div>
  );
}
