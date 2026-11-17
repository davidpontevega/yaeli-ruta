import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { getCustomer } from "@/modules/customers";
import { AccountView, AdjustmentForm, PaymentForm, getAccount } from "@/modules/accounts";

export default async function CustomerAccountPage({ params }: PageProps<"/clientes/[id]/cuenta">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [customer, account] = await Promise.all([getCustomer(id.data), getAccount(id.data)]);
  if (!customer) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/clientes" label="Clientes" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">{customer.name}</h1>
        <div className="flex gap-3">
          <Link href={`/clientes/${customer.id}/estado`} className="text-sm text-primary underline">
            Estado de cuenta
          </Link>
          <Link href={`/clientes/${customer.id}`} className="text-sm text-primary underline">
            Editar cliente
          </Link>
        </div>
      </div>
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
