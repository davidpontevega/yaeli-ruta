import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { RouteForm, RouteList, listRoutes } from "@/modules/customers";
import { ICONS, IconTile } from "@/components/ui/avatar";

export default async function RoutesPage() {
  await requireUser("DUENO");
  const routes = await listRoutes();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Rutas</h1>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="tarjeta flex flex-col gap-4 lg:sticky lg:top-6">
          <h2 className="titulo-tarjeta">
            <IconTile d={ICONS.plus} />
            Nueva ruta
          </h2>
          <RouteForm />
        </div>
        <RouteList routes={routes} />
      </div>
    </section>
  );
}
