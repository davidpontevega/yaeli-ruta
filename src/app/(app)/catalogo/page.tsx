import Link from "next/link";
import { requireUser } from "@/server/auth";
import { CatalogSummary, getCatalogSummary } from "@/modules/catalog";

export default async function CatalogPage() {
  await requireUser("DUENO");
  const summary = await getCatalogSummary();
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Ajustes</h1>
      <Link href="/usuarios" className="tarjeta flex items-center justify-between font-semibold">
        Usuarios y PIN <span className="text-muted">→</span>
      </Link>
      <CatalogSummary summary={summary} />
    </section>
  );
}
