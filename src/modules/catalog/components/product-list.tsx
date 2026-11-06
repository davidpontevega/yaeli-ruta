import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { setProductActive } from "../actions";
import { PRODUCT_LIST_LIMIT, type ProductListItem } from "../queries";

export function ProductList({ products, canEdit }: { products: ProductListItem[]; canEdit: boolean }) {
  return (
    <>
      <p className="text-sm text-muted">
        {products.length} productos{products.length === PRODUCT_LIST_LIMIT && ` (se muestran los primeros ${PRODUCT_LIST_LIMIT})`}
      </p>
      <ul className="flex flex-col gap-2">
        {products.map((p) => (
          <li key={p.id} className={`tarjeta flex flex-col gap-2 ${p.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold leading-tight">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.sku} · {p.category}
                  {p.brand && ` · ${p.brand}`}
                  {!p.active && " · Inactivo"}
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <Link href={`/productos/${p.id}/movimientos`} className="btn-secundario flex h-9 items-center text-sm" aria-label="Movimientos">
                    Kardex
                  </Link>
                  <Link href={`/productos/${p.id}`} className="btn-secundario flex h-9 items-center text-sm">
                    Editar
                  </Link>
                  <form action={setProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button className="btn-secundario h-9 text-sm">{p.active ? "Ocultar" : "Activar"}</button>
                  </form>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {p.packagings.map((x) => (
                <span key={x.id} className="rounded-lg bg-slate-100 px-2 py-1">
                  {x.name}
                  {x.factor > 1 && ` ×${x.factor}`} · <b>{formatSoles(x.salePrice)}</b>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
