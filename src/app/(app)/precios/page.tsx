import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { PriceReview, listPriceReview } from "@/modules/catalog";

export default async function PricesPage({ searchParams }: PageProps<"/precios">) {
  await requireUser("DUENO");
  const raised = Number((await searchParams).recepcion) || 0; // products whose cost went up in the receipt just saved
  const items = await listPriceReview();

  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/productos" label="Productos" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Precios por revisar</h1>
      {raised > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Ingreso guardado. Subió el costo de {raised} producto{raised === 1 ? "" : "s"}: revisa sus precios de venta.
        </p>
      )}
      <div className="tarjeta flex items-start gap-3 border-sky-200 bg-sky-50">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </span>
        <p className="text-sm text-sky-900">
          <b>Precio sugerido</b> = último costo × (1 + tu % de ganancia), redondeado hacia arriba a S/ 0.10. Desmarca los que no quieras cambiar.
        </p>
      </div>
      <PriceReview items={items} />
    </section>
  );
}
