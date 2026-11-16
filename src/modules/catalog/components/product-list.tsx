import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { Avatar, Glyph } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { setProductActive } from "../actions";
import { PRODUCT_LIST_LIMIT, type ProductListItem } from "../queries";

const G = {
  kardex: "M3 3v18h18M7 15l4-4 3 3 5-6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z",
  hide: "M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M1 1l22 22",
  show: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

function Stat({ href, label, value, tone = "" }: { href?: string; label: string; value: number; tone?: string }) {
  const cls = "tarjeta flex flex-col gap-0.5 px-4 py-3";
  const body = (
    <>
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`cifra text-2xl ${tone}`}>{value}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-slate-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Summary strip and one card per product: who supplies it, its packagings with price, and quick actions. */
export function ProductList({ products, canEdit, priceReview }: { products: ProductListItem[]; canEdit: boolean; priceReview: number }) {
  const categories = new Set(products.map((p) => p.category)).size;
  const noSupplier = products.filter((p) => !p.supplierName).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label={products.length === PRODUCT_LIST_LIMIT ? `Productos (primeros ${PRODUCT_LIST_LIMIT})` : "Productos"} value={products.length} />
        <Stat label="Categorías" value={categories} />
        <Stat href="/productos?proveedor=none" label="Sin proveedor" value={noSupplier} tone={noSupplier ? "text-amber-700" : ""} />
        {canEdit ? (
          <Stat href="/precios" label="Precios por revisar" value={priceReview} tone={priceReview ? "text-sky-700" : ""} />
        ) : (
          <Stat label="Con caja o display" value={products.filter((p) => p.packagings.length > 1).length} />
        )}
      </div>

      {!products.length ? (
        <EmptyState text="No hay productos con ese filtro." />
      ) : (
        <ul className="grid items-start gap-3 lg:grid-cols-2">
          {products.map((p) => (
            <li key={p.id} className={`tarjeta flex flex-col gap-3 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <Avatar name={p.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="font-semibold leading-tight">{p.name}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="chip bg-slate-100 text-slate-600">{p.sku}</span>
                    <span className="chip bg-teal-50 text-teal-800">{p.category}</span>
                    {p.brand && <span className="chip bg-violet-50 text-violet-800">{p.brand}</span>}
                    {p.supplierName ? (
                      <span className="chip bg-sky-50 text-sky-800">{p.supplierName}</span>
                    ) : (
                      <span className="chip bg-amber-50 text-amber-800">sin proveedor</span>
                    )}
                    {!p.active && <span className="chip bg-slate-200 text-slate-700">inactivo</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.packagings.map((x) => (
                  <span key={x.id} className="flex flex-col rounded-xl border border-border bg-slate-50 px-3 py-1.5">
                    <span className="text-[11px] font-medium text-muted">
                      {x.name}
                      {x.factor > 1 && ` ×${x.factor}`}
                    </span>
                    <span className="cifra text-[15px]">{formatSoles(x.salePrice)}</span>
                  </span>
                ))}
              </div>

              {canEdit && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link href={`/productos/${p.id}`} className="btn-suave h-9 px-3 text-sm">
                    <Glyph d={G.edit} />
                    Editar
                  </Link>
                  <Link href={`/productos/${p.id}/movimientos`} className="btn-secundario inline-flex h-9 items-center gap-2 px-3 text-sm">
                    <Glyph d={G.kardex} />
                    Kardex
                  </Link>
                  <form action={setProductActive} className="ml-auto">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted hover:bg-slate-100 hover:text-foreground">
                      <Glyph d={p.active ? G.hide : G.show} />
                      {p.active ? "Ocultar" : "Activar"}
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
