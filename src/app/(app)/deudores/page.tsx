import Link from "next/link";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listRoutes } from "@/modules/customers";
import { DebtorList, RouteFilter, listDebtors } from "@/modules/accounts";

export default async function DebtorsPage({ searchParams }: PageProps<"/deudores">) {
  await requireUser("DUENO");
  const ruta = z.uuid().safeParse((await searchParams).ruta);
  const routeId = ruta.success ? ruta.data : "";
  const [debtors, routes] = await Promise.all([listDebtors({ routeId }), listRoutes()]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Deudores</h1>
        <Link href="/deudores/inicial" className="text-sm text-primary underline">
          Cargar deuda inicial
        </Link>
      </div>
      <RouteFilter routeId={routeId} routes={routes} />
      <DebtorList debtors={debtors} />
    </section>
  );
}
