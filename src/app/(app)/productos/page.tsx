import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ProductFilters, ProductList, listCatalogOptions, listProducts, listPriceReview } from "@/modules/catalog";
import { listStock } from "@/modules/inventory";

export default async function ProductsPage({ searchParams }: PageProps<"/productos">) {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q.trim() : "",
    categoryId: typeof sp.cat === "string" ? sp.cat : "",
    supplierId: typeof sp.proveedor === "string" ? sp.proveedor : "",
    includeInactive: sp.inactivos === "1" && isOwner,
  };
  const [products, { categories, suppliers }, review, stock] = await Promise.all([
    listProducts(filters),
    listCatalogOptions(),
    isOwner ? listPriceReview() : [],
    listStock({ ...filters, onlyMissing: false, withCost: false }),
  ]);
  const stockById = Object.fromEntries(stock.map((s) => [s.id, { total: s.total, status: s.status }]));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Productos</h1>
        {isOwner && (
          <Link href="/productos/nuevo" className="btn-primario flex h-10 items-center text-sm">
            + Nuevo
          </Link>
        )}
      </div>
      <ProductFilters {...filters} categories={categories} suppliers={suppliers} canSeeInactive={isOwner} />
      <ProductList products={products} canEdit={isOwner} priceReview={review.length} stock={stockById} />
    </section>
  );
}
