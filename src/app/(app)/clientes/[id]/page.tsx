import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { toSolesInput } from "@/lib/money";
import { listProducts } from "@/modules/catalog";
import { CustomerForm, SpecialPrices, getCustomer, listRoutes, listSpecialPrices } from "@/modules/customers";

export default async function EditCustomerPage({ params }: PageProps<"/clientes/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [c, routes, prices, products] = await Promise.all([
    getCustomer(id.data),
    listRoutes(),
    listSpecialPrices(id.data),
    listProducts({ q: "", categoryId: "", includeInactive: false }),
  ]);
  if (!c) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Editar cliente</h1>
      <CustomerForm
        routes={routes}
        initial={{
          id: c.id,
          name: c.name,
          phone: c.phone ?? "",
          routeId: c.routeId,
          address: c.address ?? "",
          reference: c.reference ?? "",
          creditLimit: c.creditLimit === null ? "" : toSolesInput(c.creditLimit),
          active: c.active,
        }}
      />
      <SpecialPrices customerId={c.id} prices={prices} products={products} />
    </section>
  );
}
