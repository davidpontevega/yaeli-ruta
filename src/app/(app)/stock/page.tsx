import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ProductFilters, listCatalogOptions } from "@/modules/catalog";
import { StockList, getAlertCounts, listStock } from "@/modules/inventory";

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
    listStock({ ...filters, withCost: isOwner }),
    listCatalogOptions(),
    getAlertCounts(),
  ]);
  const expiring = alerts.expired + alerts.within30;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Stock</h1>
        <Link href="/vencimientos" className={`btn-secundario flex h-10 items-center text-sm ${expiring ? "border-amber-300 text-amber-800" : ""}`}>
          Por vencer ({expiring})
        </Link>
      </div>
      <ProductFilters {...filters} includeInactive={false} categories={categories} suppliers={suppliers} canSeeInactive={false} />
      <StockList items={items} />
    </section>
  );
}
