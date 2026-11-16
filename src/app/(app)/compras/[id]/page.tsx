import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listCatalogOptions, listProducts } from "@/modules/catalog";
import { PurchaseForm, defaultCosts, getPurchase, listMissingBySupplier, listVehicles } from "@/modules/purchases";

const STATUS = { BORRADOR: "", RECIBIDA: " · Recibida", ANULADA: " · Anulada" } as const;

export default async function PurchasePage({ params }: PageProps<"/compras/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const purchase = await getPurchase(id.data);
  if (!purchase) notFound();
  const editable = purchase.status === "BORRADOR";
  const [products, { suppliers }, vehicles, costs, missing] = await Promise.all([
    // A list may hold products deactivated since: show them (the form marks them and the picker hides them).
    listProducts({ q: "", categoryId: "", includeInactive: true }),
    listCatalogOptions(),
    listVehicles(),
    defaultCosts(),
    editable ? listMissingBySupplier() : [],
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">
        Compra #{purchase.number}
        {STATUS[purchase.status]}
      </h1>
      <PurchaseForm
        products={products}
        suppliers={suppliers}
        vehicles={vehicles}
        costs={costs}
        missing={missing}
        initial={{
          id: purchase.id,
          number: purchase.number,
          type: purchase.type,
          supplierId: purchase.supplierId ?? "",
          vehicleId: purchase.vehicleId ?? "",
          lines: purchase.items,
        }}
        editable={editable}
      />
    </section>
  );
}
