import { requireUser } from "@/server/auth";
import { CatalogSummary, getCatalogSummary } from "@/modules/catalog";

export default async function CatalogPage() {
  await requireUser("DUENO");
  const summary = await getCatalogSummary();
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Catálogo</h1>
      <CatalogSummary summary={summary} />
    </section>
  );
}
