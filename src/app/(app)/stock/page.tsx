import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ProductFilters, listCatalogOptions } from "@/modules/catalog";
import { StockList, listStock } from "@/modules/inventory";

export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q.trim() : "",
    categoryId: typeof sp.cat === "string" ? sp.cat : "",
  };
  const [items, { categories }] = await Promise.all([listStock({ ...filters, withCost: isOwner }), listCatalogOptions()]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Stock</h1>
        {isOwner && (
          <Link href="/recepciones/nueva" className="btn-primario flex h-10 items-center text-sm">
            + Recibir
          </Link>
        )}
      </div>
      <ProductFilters {...filters} includeInactive={false} categories={categories} canSeeInactive={false} />
      <StockList items={items} />
    </section>
  );
}
