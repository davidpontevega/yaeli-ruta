import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { CustomerForm, listRoutes } from "@/modules/customers";

export default async function NewCustomerPage({ searchParams }: PageProps<"/clientes/nuevo">) {
  await requireUser("DUENO");
  const routes = await listRoutes();
  if (!routes.length) redirect("/rutas");
  const { ruta } = await searchParams;
  const routeId = typeof ruta === "string" && routes.some((r) => r.id === ruta) ? ruta : routes.length === 1 ? routes[0].id : "";
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nuevo cliente</h1>
      <CustomerForm routes={routes} initial={{ id: "", name: "", phone: "", routeId, address: "", reference: "", creditLimit: "", active: true }} />
    </section>
  );
}
