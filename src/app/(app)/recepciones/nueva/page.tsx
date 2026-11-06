import { requireUser } from "@/server/auth";
import { isDocumentReaderEnabled } from "@/server/ai/document-reader";
import { listProducts } from "@/modules/catalog";
import { ReceiptForm, getLastCosts, listLocations, listReadAliases } from "@/modules/inventory";

export default async function NewReceiptPage() {
  await requireUser("DUENO");
  const [products, locations, lastCosts, aliases] = await Promise.all([
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    listLocations(),
    getLastCosts(),
    listReadAliases(),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Recibir mercadería</h1>
      <ReceiptForm products={products} locations={locations} lastCosts={lastCosts} aliases={aliases} readerEnabled={isDocumentReaderEnabled()} />
    </section>
  );
}
