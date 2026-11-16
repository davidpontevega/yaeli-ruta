import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { SupplierList, listSupplierStats } from "@/modules/inventory";

export default async function SuppliersPage() {
  await requireUser("DUENO");
  const suppliers = await listSupplierStats();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/compras" label="Compras" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Proveedores</h1>
      <SupplierList suppliers={suppliers} />
    </section>
  );
}
