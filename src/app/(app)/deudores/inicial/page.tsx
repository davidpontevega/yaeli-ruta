import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listRoutes } from "@/modules/customers";
import { todayInLima } from "@/modules/inventory";
import { InitialDebtForm, RouteFilter, listWithoutInitialDebt } from "@/modules/accounts";

export default async function InitialDebtPage({ searchParams }: PageProps<"/deudores/inicial">) {
  await requireUser("DUENO");
  const ruta = z.uuid().safeParse((await searchParams).ruta);
  const routeId = ruta.success ? ruta.data : "";
  const [customers, routes] = await Promise.all([listWithoutInitialDebt({ routeId }), listRoutes()]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Deuda inicial</h1>
      <p className="text-sm text-muted">
        Pasa lo que cada cliente debe según el cuaderno. Deja vacío a quien no debe. Se carga una sola vez por cliente.
      </p>
      <RouteFilter routeId={routeId} routes={routes} />
      <InitialDebtForm key={routeId} customers={customers} today={todayInLima()} />
    </section>
  );
}
