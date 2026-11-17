import { requireUser } from "@/server/auth";
import { createSupplier } from "@/modules/inventory";
import { BackLink } from "@/components/ui/back-link";
import { listCatalogOptions, listProducts } from "@/modules/catalog";
import { PurchaseForm, defaultCosts, listMissingBySupplier, listVehicles } from "@/modules/purchases";

export default async function NewPurchasePage() {
  await requireUser("DUENO");
  const [products, { suppliers }, vehicles, costs, missing] = await Promise.all([
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    listCatalogOptions(),
    listVehicles(),
    defaultCosts(),
    listMissingBySupplier(),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/compras" label="Compras" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nueva compra</h1>
      <PurchaseForm
        products={products}
        suppliers={suppliers}
        createSupplier={createSupplier}
        vehicles={vehicles}
        costs={costs}
        missing={missing}
        initial={{ type: "ENVIA_PROVEEDOR", supplierId: "", vehicleId: "", lines: [] }}
        editable
      />
    </section>
  );
}
