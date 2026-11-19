import { requireUser } from "@/server/auth";
import { canSee } from "@/lib/menus";
import { CatalogSummary, getCatalogSummary } from "@/modules/catalog";

export default async function CatalogPage() {
  const me = await requireUser("DUENO");
  const summary = await getCatalogSummary();
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Ajustes</h1>
      <p className="-mt-3 text-sm text-muted">Usuarios, proveedores y las listas que usan los productos: categorías, marcas, pisos y vehículos.</p>
      <CatalogSummary summary={summary} can={(href) => canSee(href, me.role, me.hiddenMenus)} isAdmin={me.isAdmin} />
    </section>
  );
}
