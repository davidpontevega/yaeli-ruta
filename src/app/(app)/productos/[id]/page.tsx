import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { toSolesInput } from "@/lib/money";
import { toKgInput } from "@/lib/weight";
import { ProductForm, getProductWithPackagings, listCatalogOptions } from "@/modules/catalog";
import { getLastCosts, createSupplier } from "@/modules/inventory";

export default async function EditProductPage({ params }: PageProps<"/productos/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [p, { categories, brands, suppliers }, lastCosts] = await Promise.all([
    getProductWithPackagings(id.data),
    listCatalogOptions(),
    getLastCosts(),
  ]);
  if (!p) notFound();

  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/productos" label="Productos" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Editar producto</h1>
      <ProductForm
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        createSupplier={createSupplier}
        initial={{
          id: p.id,
          sku: p.sku,
          name: p.name,
          categoryId: p.categoryId,
          brandId: p.brandId ?? "",
          supplierId: p.supplierId ?? "",
          minStock: p.minStock,
          marginPct: p.marginPct,
          packagings: p.packagings.map((x) => ({
            id: x.id,
            name: x.name,
            factor: String(x.factor),
            price: toSolesInput(x.salePrice),
            barcode: x.barcode ?? "",
            // Cost of its last receipt; else the product's last cost per unit × factor; else empty.
            cost: lastCosts[x.id] ? toSolesInput(lastCosts[x.id]) : p.lastCost ? toSolesInput(p.lastCost * x.factor) : "",
            weightKg: toKgInput(x.weightGrams),
          })),
        }}
      />
    </section>
  );
}
