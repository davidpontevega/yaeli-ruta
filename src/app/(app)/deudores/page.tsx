import Link from "next/link";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { listRoutes } from "@/modules/customers";
import { DebtorList, RouteFilter, listDebtors } from "@/modules/accounts";

export default async function DebtorsPage({ searchParams }: PageProps<"/deudores">) {
  await requireUser("DUENO");
  const ruta = z.uuid().safeParse((await searchParams).ruta);
  const routeId = ruta.success ? ruta.data : "";
  const [debtors, routes] = await Promise.all([listDebtors({ routeId }), listRoutes()]);
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Deudores</h1>
        <Link href="/deudores/inicial" className="btn-suave h-10 text-sm">
          Cargar deuda inicial
        </Link>
      </div>
      <RouteFilter routeId={routeId} routes={routes} />
      <DebtorList debtors={debtors} />
    </section>
  );
}
