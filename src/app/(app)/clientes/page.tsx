import Link from "next/link";
import { requireUser } from "@/server/auth";
import { CustomerFilters, CustomerList, listCustomers, listRoutes } from "@/modules/customers";
import { balancesByCustomer } from "@/modules/accounts";

export default async function CustomersPage({ searchParams }: PageProps<"/clientes">) {
  await requireUser("DUENO");
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q.trim() : "",
    routeId: typeof sp.ruta === "string" ? sp.ruta : "",
    includeInactive: sp.inactivos === "1",
  };
  const routes = await listRoutes();
  if (filters.routeId && !routes.some((r) => r.id === filters.routeId)) filters.routeId = "";
  const customers = routes.length ? await listCustomers(filters) : [];
  const balances = await balancesByCustomer(customers.map((c) => c.id));
  const repeated = typeof sp.repetido === "string" ? sp.repetido : "";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Clientes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/deudores" className="btn-suave h-10 text-sm">
            Deudores
          </Link>
          <Link href="/rutas" className="btn-suave h-10 text-sm">
            Rutas
          </Link>
          {routes.length > 0 && (
            <Link
              href={`/clientes/nuevo${filters.routeId ? `?ruta=${filters.routeId}` : ""}`}
              className="btn-primario flex h-10 items-center text-sm"
            >
              + Nuevo
            </Link>
          )}
        </div>
      </div>
      {!routes.length ? (
        <div className="tarjeta flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-semibold">Primero crea una ruta</p>
          <p className="max-w-sm text-sm text-muted">Cada cliente pertenece a una ruta de reparto.</p>
          <Link href="/rutas" className="btn-primario flex h-10 items-center text-sm">
            Crear ruta
          </Link>
        </div>
      ) : (
        <>
          {repeated && (
            <p className="tarjeta text-sm text-amber-700">Guardado. Ojo: ya había otro cliente llamado &quot;{repeated}&quot; en esta ruta.</p>
          )}
          <CustomerFilters {...filters} routes={routes} />
          <CustomerList customers={customers} canReorder={!!filters.routeId && !filters.q} balances={balances} routes={routes} />
        </>
      )}
    </section>
  );
}
