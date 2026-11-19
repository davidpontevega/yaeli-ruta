import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { PhotoFiller, getCatalogSheet } from "@/modules/catalog";

export default async function PhotoFillerPage() {
  await requireUser("DUENO");
  const sheet = await getCatalogSheet();
  const missing = sheet.flatMap((c) =>
    c.products.filter((p) => p.photoVersion === null).map((p) => ({ id: p.id, name: p.name, category: c.category })),
  );
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/productos" label="Productos" />
      <div>
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Completar fotos</h1>
        <p className="text-muted">Productos del catálogo que aún no tienen foto, uno a la vez.</p>
      </div>
      <PhotoFiller products={missing} />
    </section>
  );
}
