import Link from "next/link";
import { Stat } from "@/components/ui/stat";
import { formatSoles } from "@/lib/money";
import { Avatar, Glyph, ICONS, IconTile } from "@/components/ui/avatar";
import { formatQty } from "@/lib/quantity";
import { EmptyState } from "@/components/ui/empty-state";
import { setProductActive } from "../actions";
import { PRODUCT_LIST_LIMIT, type ProductListItem } from "../queries";

const G = {
  kardex: "M3 3v18h18M7 15l4-4 3 3 5-6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z",
  hide: "M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M1 1l22 22",
  show: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

const STOCK = {
  out: "bg-red-100 text-red-700",
  low: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-50 text-emerald-800",
} as const;

/** A packaging without weight leaves the truck load of purchase lists incomplete. */
const noWeight = (p: ProductListItem) => p.packagings.some((x) => !x.weightGrams);

/**
 * Summary strip, then products grouped by category: who supplies it, its stock, its packagings with price, and quick actions.
 * `stock`: base units and status per active product (inactive ones have none).
 */
export function ProductList({
  products,
  canEdit,
  priceReview,
  stock,
}: {
  products: ProductListItem[];
  canEdit: boolean;
  priceReview: number;
  stock: Record<string, { total: number; status: keyof typeof STOCK }>;
}) {
  const noSupplier = products.filter((p) => !p.supplierName).length;
  const missingWeight = products.filter(noWeight).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label={products.length === PRODUCT_LIST_LIMIT ? `Productos (primeros ${PRODUCT_LIST_LIMIT})` : "Productos"} value={products.length} />
        {canEdit ? (
          <Stat label="Sin peso" value={missingWeight} tone={missingWeight ? "text-amber-700" : ""} hint="para el flete" />
        ) : (
          <Stat label="Categorías" value={new Set(products.map((p) => p.category)).size} />
        )}
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
        <div className="flex flex-col gap-6">
          {[...Map.groupBy(products, (p) => p.category)].map(([category, list]) => (
            <section key={category} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2.5 px-1">
                <IconTile d={ICONS.box} />
                <span className="font-bold">{category}</span>
                <span className="chip bg-slate-100 text-slate-700">{list.length}</span>
              </h2>
              <ul className="grid items-start gap-3 lg:grid-cols-2">
                {list.map((p) => (
                  <li key={p.id} className={`tarjeta flex flex-col gap-3 ${p.active ? "" : "opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      <Avatar name={p.name} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-tight">{p.name}</p>
                          {stock[p.id] && (
                            <span className={`chip shrink-0 ${STOCK[stock[p.id].status]}`}>
                              {stock[p.id].total ? formatQty(stock[p.id].total, p.packagings) : "sin stock"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="chip bg-slate-100 text-slate-600">{p.sku}</span>
                          <span className="chip bg-teal-50 text-teal-800">{p.category}</span>
                          {p.brand && <span className="chip bg-violet-50 text-violet-800">{p.brand}</span>}
                          {p.supplierName ? (
                            <span className="chip bg-sky-50 text-sky-800">{p.supplierName}</span>
                          ) : (
                            <span className="chip bg-amber-50 text-amber-800">sin proveedor</span>
                          )}
                          {canEdit && noWeight(p) && <span className="chip bg-amber-50 text-amber-800">sin peso</span>}
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
            </section>
          ))}
        </div>
      )}
    </>
  );
}
