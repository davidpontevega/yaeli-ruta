import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { toSolesInput } from "@/lib/money";
import { ProductForm, getProductWithPackagings, listCatalogOptions } from "@/modules/catalog";

export default async function EditProductPage({ params }: PageProps<"/productos/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [p, { categories, brands }] = await Promise.all([getProductWithPackagings(id.data), listCatalogOptions()]);
  if (!p) notFound();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <ProductForm
        categories={categories}
        brands={brands}
        initial={{
          id: p.id,
          sku: p.sku,
          name: p.name,
          categoryId: p.categoryId,
          brandId: p.brandId ?? "",
          minStock: p.minStock,
          marginPct: p.marginPct,
          packagings: p.packagings.map((x) => ({
            id: x.id,
            name: x.name,
            factor: String(x.factor),
            price: toSolesInput(x.salePrice),
            barcode: x.barcode ?? "",
          })),
        }}
      />
    </section>
  );
}
