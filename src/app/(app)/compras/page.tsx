import Link from "next/link";
import { requireUser } from "@/server/auth";
import { PurchaseList, listPurchases } from "@/modules/purchases";

export default async function PurchasesPage() {
  await requireUser("DUENO");
  const purchases = await listPurchases();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Compras</h1>
        <Link href="/compras/nueva" className="btn-primario flex h-10 items-center text-sm">
          + Nueva compra
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/recepciones/nueva" className="btn-suave h-10">
          Recibir sin lista
        </Link>
        <Link href="/proveedores" className="btn-suave h-10">
          Proveedores
        </Link>
      </div>
      <PurchaseList purchases={purchases} />
    </section>
  );
}
