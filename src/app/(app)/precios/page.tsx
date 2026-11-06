import { requireUser } from "@/server/auth";
import { PriceReview, listPriceReview } from "@/modules/catalog";

export default async function PricesPage({ searchParams }: PageProps<"/precios">) {
  await requireUser("DUENO");
  const raised = Number((await searchParams).recepcion) || 0; // products whose cost went up in the receipt just saved
  const items = await listPriceReview();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Precios por revisar</h1>
      {raised > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Ingreso guardado. Subió el costo de {raised} producto{raised === 1 ? "" : "s"}: revisa sus precios de venta.
        </p>
      )}
      <p className="text-sm text-muted">Precio sugerido = último costo × (1 + tu margen), redondeado hacia arriba a 10 céntimos.</p>
      <PriceReview items={items} />
    </section>
  );
}
