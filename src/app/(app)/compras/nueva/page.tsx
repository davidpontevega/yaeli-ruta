import { requireUser } from "@/server/auth";
import { createSupplier } from "@/modules/inventory";
import { BackLink } from "@/components/ui/back-link";
import { listCatalogOptions, listProducts, quickCreateProduct } from "@/modules/catalog";
import { PurchaseForm, defaultCosts, listMissingBySupplier, listVehicles } from "@/modules/purchases";

export default async function NewPurchasePage() {
  await requireUser("DUENO");
  const [products, { suppliers, categories }, vehicles, costs, missing] = await Promise.all([
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    listCatalogOptions(),
    listVehicles(),
    defaultCosts(),
    listMissingBySupplier(),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/compras" label="Listas de pedido" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nueva lista de pedido</h1>
      <PurchaseForm
        products={products}
        suppliers={suppliers}
        createSupplier={createSupplier}
        categories={categories}
        quickCreateProduct={quickCreateProduct}
        vehicles={vehicles}
        costs={costs}
        missing={missing}
        initial={{ type: "ENVIA_PROVEEDOR", supplierId: "", vehicleId: "", lines: [] }}
        editable
      />
    </section>
  );
}
