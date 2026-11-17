import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { SupplierList, createSupplier, listStock, listSupplierStats, type SupplierProducts } from "@/modules/inventory";
import { SupplierQuickAdd } from "@/components/ui/supplier-quick-add";
import { ICONS, IconTile } from "@/components/ui/avatar";

export default async function SuppliersPage() {
  await requireUser("DUENO");
  const [suppliers, stock] = await Promise.all([
    listSupplierStats(),
    listStock({ q: "", categoryId: "", supplierId: "", onlyMissing: false, withCost: false }),
  ]);
  const products: SupplierProducts = {};
  for (const p of stock) {
    if (!p.supplierId) continue;
    const c = (products[p.supplierId] ??= { products: 0, missing: 0 });
    c.products++;
    if (p.status !== "ok") c.missing++;
  }
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/compras" label="Listas de pedido" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Proveedores</h1>
      <p className="-mt-2 text-sm text-muted">A quién le compras: qué le falta pedir, cuánto le has comprado y cómo contactarlo.</p>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="tarjeta flex flex-col gap-3 lg:sticky lg:top-6 lg:order-2">
          <h2 className="titulo-tarjeta">
            <IconTile d={ICONS.plus} />
            Nuevo proveedor
          </h2>
          <SupplierQuickAdd action={createSupplier} open />
        </div>
        <div className="min-w-0 lg:order-1">
          <SupplierList suppliers={suppliers} products={products} />
        </div>
      </div>
    </section>
  );
}
