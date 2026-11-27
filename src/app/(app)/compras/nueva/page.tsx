import { z } from "zod";
import { requireUser } from "@/server/auth";
import { createSupplier } from "@/modules/inventory";
import { BackLink } from "@/components/ui/back-link";
import { listCatalogOptions, listProducts, quickCreateProduct } from "@/modules/catalog";
import { PurchaseForm, defaultCosts, listMissingBySupplier, listVehicles } from "@/modules/purchases";

export default async function NewPurchasePage({ searchParams }: PageProps<"/compras/nueva">) {
  await requireUser("DUENO");
  const proveedor = z.uuid().safeParse((await searchParams).proveedor);
  const [products, { suppliers, categories }, vehicles, costs, missing] = await Promise.all([
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    listCatalogOptions(),
    listVehicles(),
    defaultCosts(),
    listMissingBySupplier(),
  ]);
  // From "Stock bajo": that supplier's missing products come already in the list.
  const supplierId = proveedor.success && suppliers.some((s) => s.id === proveedor.data) ? proveedor.data : "";
  const lines = missing
    .filter((m) => supplierId && m.supplierId === supplierId)
    .map((m) => ({ packagingId: m.packagingId, quantity: m.quantity, cost: costs[m.packagingId] ?? 0, freight: 0 }));
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/compras" label="Pedir a proveedor" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nuevo pedido a proveedor</h1>
      <PurchaseForm
        products={products}
        suppliers={suppliers}
        createSupplier={createSupplier}
        categories={categories}
        quickCreateProduct={quickCreateProduct}
        vehicles={vehicles}
        costs={costs}
        missing={missing}
        initial={{ type: "ENVIA_PROVEEDOR", supplierId, vehicleId: "", lines }}
        editable
      />
    </section>
  );
}
