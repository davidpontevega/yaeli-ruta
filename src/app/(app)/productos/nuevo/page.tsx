import { requireUser } from "@/server/auth";
import { createSupplier } from "@/modules/inventory";
import { BackLink } from "@/components/ui/back-link";
import { ProductForm, listCatalogOptions } from "@/modules/catalog";

export default async function NewProductPage() {
  await requireUser("DUENO");
  const { categories, brands, suppliers } = await listCatalogOptions();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/productos" label="Productos" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nuevo producto</h1>
      <ProductForm
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        createSupplier={createSupplier}
        initial={{
          sku: "",
          name: "",
          categoryId: "",
          brandId: "",
          supplierId: "",
          minStock: 0,
          marginPct: 15,
          packagings: [{ name: "unidad", factor: "1", cost: "", price: "", barcode: "", weightKg: "" }],
        }}
      />
    </section>
  );
}
