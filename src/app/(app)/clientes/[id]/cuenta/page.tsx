import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { CustomerHeader, getCustomer, listRoutes } from "@/modules/customers";
import { AccountView, AdjustmentForm, PaymentForm, getAccount } from "@/modules/accounts";

export default async function CustomerAccountPage({ params }: PageProps<"/clientes/[id]/cuenta">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [customer, account, routes] = await Promise.all([getCustomer(id.data), getAccount(id.data), listRoutes()]);
  if (!customer) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <CustomerHeader
        customer={{ ...customer, routeName: routes.find((r) => r.id === customer.routeId)?.name ?? "" }}
        balance={account.balance}
        here="cuenta"
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:order-2">
          {account.balance > 0 && <PaymentForm customerId={customer.id} />}
          <AdjustmentForm customerId={customer.id} />
        </div>
        <div className="min-w-0 lg:order-1">
          <AccountView account={account} creditLimit={customer.creditLimit} />
        </div>
      </div>
    </section>
  );
}
