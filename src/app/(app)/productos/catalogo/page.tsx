import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { CatalogBuilder, getCatalogSheet } from "@/modules/catalog";

export default async function CustomerCatalogPage() {
  await requireUser("DUENO");
  const sheet = await getCatalogSheet();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/productos" label="Productos" />
      <div>
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Catálogo para clientes</h1>
        <p className="text-muted">Imágenes por categoría, sin precios, para mandar por WhatsApp.</p>
      </div>
      <CatalogBuilder sheet={sheet} />
    </section>
  );
}
