import { requireUser } from "@/server/auth";
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
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nueva compra</h1>
      <PurchaseForm
        products={products}
        suppliers={suppliers}
        vehicles={vehicles}
        costs={costs}
        missing={missing}
        initial={{ type: "ENVIA_PROVEEDOR", supplierId: "", vehicleId: "", lines: [] }}
        editable
      />
    </section>
  );
}
