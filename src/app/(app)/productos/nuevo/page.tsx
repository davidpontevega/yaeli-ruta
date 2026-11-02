import { requireUser } from "@/server/auth";
import { ProductForm, listCatalogOptions } from "@/modules/catalog";

export default async function NewProductPage() {
  await requireUser("DUENO");
  const { categories, brands } = await listCatalogOptions();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <ProductForm
        categories={categories}
        brands={brands}
        initial={{
          sku: "",
          name: "",
          categoryId: "",
          brandId: "",
          minStock: 0,
          marginPct: 15,
          packagings: [{ name: "unidad", factor: "1", price: "", barcode: "" }],
        }}
      />
    </section>
  );
}
