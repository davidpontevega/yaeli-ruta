import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">{customer.name}</h1>
        <Link href={`/clientes/${customer.id}`} className="text-sm text-primary underline">
          Editar cliente
        </Link>
      </div>
      {account.balance > 0 && <PaymentForm customerId={customer.id} />}
      <AdjustmentForm customerId={customer.id} />
      <AccountView account={account} creditLimit={customer.creditLimit} />
    </section>
  );
}
