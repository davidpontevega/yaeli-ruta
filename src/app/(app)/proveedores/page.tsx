import { requireUser } from "@/server/auth";
import { SupplierList, listSupplierStats } from "@/modules/inventory";

export default async function SuppliersPage() {
  await requireUser("DUENO");
  const suppliers = await listSupplierStats();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Proveedores</h1>
      <SupplierList suppliers={suppliers} />
    </section>
  );
}
