import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getPurchase, landedUnitCost } from "@/modules/purchases";
import { isDocumentReaderEnabled } from "@/server/ai/document-reader";
import { listProducts } from "@/modules/catalog";
import { ReceiptForm, getLastCosts, listLocations, listReadAliases, listSupplierNames } from "@/modules/inventory";

export default async function NewReceiptPage({ searchParams }: PageProps<"/recepciones/nueva">) {
  await requireUser("DUENO");
  const compra = z.uuid().safeParse((await searchParams).compra);
  const purchase = compra.success ? await getPurchase(compra.data) : null;
  const [products, locations, lastCosts, aliases, supplierNames] = await Promise.all([
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    listLocations(),
    getLastCosts(),
    listReadAliases(),
    listSupplierNames(),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Recibir mercadería{purchase && ` · compra #${purchase.number}`}</h1>
      {purchase && purchase.status !== "BORRADOR" && (
        <p className="tarjeta text-sm text-amber-700">
          Esta compra ya fue {purchase.status === "RECIBIDA" ? "recibida" : "anulada"}; no se puede recibir otra vez.
        </p>
      )}
      <ReceiptForm
        products={products}
        locations={locations}
        lastCosts={lastCosts}
        aliases={aliases}
        aiEnabled={isDocumentReaderEnabled()}
        supplierNames={supplierNames}
        initial={
          purchase?.status === "BORRADOR"
            ? {
                purchaseId: purchase.id,
                supplier: purchase.supplierName ?? "",
                lines: purchase.items.map((i) => ({
                  packagingId: i.packagingId,
                  quantity: i.quantity,
                  unitCost: landedUnitCost(i.cost, i.freight, i.quantity),
                })),
              }
            : undefined
        }
      />
    </section>
  );
}
