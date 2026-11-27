import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listSupplierStats } from "@/modules/inventory";
import { PurchaseList, SupplierOrders, listMissingBySupplier, listPurchases } from "@/modules/purchases";

export default async function PurchasesPage() {
  await requireUser("DUENO");
  const [purchases, suppliers, missing] = await Promise.all([listPurchases(), listSupplierStats(), listMissingBySupplier()]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Pedir a proveedor</h1>
        <Link href="/compras/nueva" className="btn-primario btn-proveedor flex h-10 items-center text-sm">
          + Nueva lista
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/proveedores" className="btn-suave h-10">
          Proveedores
        </Link>
      </div>
      <SupplierOrders suppliers={suppliers} missing={missing} />
      <h2 className="rotulo">Listas guardadas</h2>
      <PurchaseList purchases={purchases} />
    </section>
  );
}
