"use client";

import { useActionState, useState } from "react";
import { ProductPicker } from "@/components/ui/product-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { ICONS, IconTile } from "@/components/ui/avatar";
import { formatSoles } from "@/lib/money";
import { deleteSpecialPrice, saveSpecialPrice } from "../actions";

type Product = { id: string; name: string; sku: string; packagings: { id: string; name: string; salePrice: number }[] };
type Row = { packagingId: string; productName: string; packagingName: string; salePrice: number; price: number };

const field = "h-12 rounded-xl border border-border bg-surface px-3";

/** Owner-only: prices this customer pays instead of the general one. Orders recompute them on the server. */
export function SpecialPrices({ customerId, prices, products }: { customerId: string; prices: Row[]; products: Product[] }) {
  const [saveState, saveAction, saving] = useActionState(saveSpecialPrice, undefined);
  const [delState, delAction, deleting] = useActionState(deleteSpecialPrice, undefined);
  const [product, setProduct] = useState<Product | null>(null);

  return (
    <div className="tarjeta flex flex-col gap-3">
      <h2 className="titulo-tarjeta">
        <IconTile d={ICONS.pencil} tone="bg-violet-50 text-violet-700" />
        Precios especiales
      </h2>
      {!prices.length && <EmptyState text="Este cliente paga el precio general en todo." />}
      {prices.map((r) => (
        <form key={r.packagingId} action={delAction} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="packagingId" value={r.packagingId} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{r.productName}</p>
            <p className="text-sm text-muted">{r.packagingName}</p>
          </div>
          <span className="cifra text-sm text-slate-500 line-through">{formatSoles(r.salePrice)}</span>
          <span className="cifra text-violet-800">{formatSoles(r.price)}</span>
          <button disabled={deleting} className="h-10 rounded-lg px-2 text-sm text-red-600 hover:bg-red-50">
            Quitar
          </button>
        </form>
      ))}
      {delState?.error && <p className="text-sm text-red-600">{delState.error}</p>}

      <form action={saveAction} className="flex flex-col gap-3 border-t border-border pt-3">
        <input type="hidden" name="customerId" value={customerId} />
        <p className="text-sm font-medium">Agregar o cambiar un precio</p>
        {product ? (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-semibold">{product.name}</p>
            <button type="button" onClick={() => setProduct(null)} className="text-sm text-primary">
              Cambiar producto
            </button>
          </div>
        ) : (
          <ProductPicker products={products} onPick={setProduct} placeholder="Busca el producto" />
        )}
        {product && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Presentación
              <select key={product.id} name="packagingId" required className={field}>
                {product.packagings.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · general {formatSoles(x.salePrice)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Precio especial (S/)
              <input name="price" required inputMode="decimal" placeholder="8.50" className={field} />
            </label>
          </div>
        )}
        <button disabled={saving || !product} className="btn-primario h-12">
          Guardar precio
        </button>
        {saveState?.error && <p className="text-sm text-red-600">{saveState.error}</p>}
        {saveState?.ok && <p className="text-sm text-emerald-700">{saveState.ok}</p>}
      </form>
    </div>
  );
}
