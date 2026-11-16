import Link from "next/link";
import { requireUser } from "@/server/auth";
import { RouteForm, RouteList, listRoutes } from "@/modules/customers";

export default async function RoutesPage() {
  await requireUser("DUENO");
  const routes = await listRoutes();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Rutas</h1>
        <Link href="/clientes" className="text-sm text-primary underline">
          Clientes
        </Link>
      </div>
      <div className="tarjeta">
        <RouteForm />
      </div>
      <RouteList routes={routes} />
    </section>
  );
}
