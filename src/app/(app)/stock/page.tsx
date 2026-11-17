import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ProductFilters, listCatalogOptions } from "@/modules/catalog";
import { LOW_COVERAGE_DAYS, StockList, getAlertCounts, listStock } from "@/modules/inventory";
import { AddToListButton } from "@/modules/purchases";

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q.trim() : "",
    categoryId: typeof sp.cat === "string" ? sp.cat : "",
    supplierId: typeof sp.proveedor === "string" ? sp.proveedor : "",
    onlyMissing: sp.falta === "1",
  };
  const [items, { categories, suppliers }, alerts] = await Promise.all([
    listStock({ ...filters, withCost: isOwner, withSales: isOwner }),
    listCatalogOptions(),
    getAlertCounts(),
  ]);
  const expiring = alerts.expired + alerts.within30;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">{filters.onlyMissing ? "Stock bajo" : "Stock"}</h1>
      </div>
      {filters.onlyMissing && (
        <p className="-mt-2 text-sm text-muted">
          Productos agotados o bajo su mínimo{isOwner && `, o que alcanzan menos de ${LOW_COVERAGE_DAYS} días`}, por proveedor.
          {isOwner && " Toca «Armar lista» y el pedido sale con lo que falta."}
        </p>
      )}
      <ProductFilters {...filters} includeInactive={false} categories={categories} suppliers={suppliers} canSeeInactive={false} />
      <div className="flex flex-wrap gap-2">
        {[
          { href: "/stock", label: "Todo", on: !filters.onlyMissing },
          { href: "/stock?falta=1", label: "Stock bajo", on: filters.onlyMissing },
          { href: "/vencimientos", label: `Por vencer · ${expiring}`, on: false },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold ${c.on ? "border-slate-900 bg-slate-900 text-white" : "border-border bg-surface text-slate-700"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>
      <StockList
        items={items}
        expiring={expiring}
        canBuy={isOwner}
        onlyMissing={filters.onlyMissing}
        buyButton={isOwner ? (p) => <AddToListButton productId={p.id} hasSupplier={!!p.supplierId} /> : undefined}
      />
    </section>
  );
}
