import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ProductFilters, ProductList, listCatalogOptions, listProducts } from "@/modules/catalog";

export default async function ProductsPage({ searchParams }: PageProps<"/productos">) {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q.trim() : "",
    categoryId: typeof sp.cat === "string" ? sp.cat : "",
    includeInactive: sp.inactivos === "1" && isOwner,
  };
  const [products, { categories }] = await Promise.all([listProducts(filters), listCatalogOptions()]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Productos</h1>
        {isOwner && (
          <Link href="/productos/nuevo" className="btn-primario flex h-10 items-center text-sm">
            + Nuevo
          </Link>
        )}
      </div>
      <ProductFilters {...filters} categories={categories} canSeeInactive={isOwner} />
      <ProductList products={products} canEdit={isOwner} />
    </section>
  );
}
