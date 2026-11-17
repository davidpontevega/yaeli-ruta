import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { getCustomer } from "@/modules/customers";
import { addDays, todayInLima } from "@/modules/inventory";
import { StatementView, getStatement, statementPeriodSchema } from "@/modules/accounts";

const STATEMENT_DAYS = 30;

export default async function CustomerStatementPage({ params, searchParams }: PageProps<"/clientes/[id]/estado">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const today = todayInLima();
  const { from, to } = statementPeriodSchema(today, addDays(today, -STATEMENT_DAYS)).parse(await searchParams);
  const [customer, statement] = await Promise.all([getCustomer(id.data), getStatement(id.data, from, to)]);
  if (!customer) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href={`/clientes/${customer.id}/cuenta`} label="Cuenta" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px] print:hidden">Estado de cuenta</h1>
      <StatementView customer={customer} statement={statement} from={from} to={to} today={today} />
    </section>
  );
}
