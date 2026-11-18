import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { toSolesInput } from "@/lib/money";
import { listProducts } from "@/modules/catalog";
import { CustomerForm, CustomerHeader, SpecialPrices, getCustomer, listRoutes, listSpecialPrices } from "@/modules/customers";
import { balancesByCustomer } from "@/modules/accounts";

export default async function EditCustomerPage({ params }: PageProps<"/clientes/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [c, routes, prices, products, balances] = await Promise.all([
    getCustomer(id.data),
    listRoutes(),
    listSpecialPrices(id.data),
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    balancesByCustomer([id.data]),
  ]);
  if (!c) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <CustomerHeader customer={{ ...c, routeName: routes.find((r) => r.id === c.routeId)?.name ?? "" }} balance={balances[c.id] ?? 0} here="ficha" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
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
      </div>
    </section>
  );
}
