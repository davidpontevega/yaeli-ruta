import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { listProducts } from "@/modules/catalog";
import { getCustomer, listCustomers, listRoutes, nextVisitDate } from "@/modules/customers";
import { todayInLima } from "@/modules/inventory";
import { balancesByCustomer } from "@/modules/accounts";
import { CustomerPicker, OrderForm, availableByProduct, lastOrderLines } from "@/modules/orders";

export default async function NewOrderPage({ searchParams }: PageProps<"/pedidos/nuevo">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await searchParams).cliente);
  const customer = id.success ? await getCustomer(id.data) : null;

  if (!customer?.active) {
    const customers = await listCustomers({ q: "", routeId: "", includeInactive: false });
    return (
      <section className="flex flex-col gap-4">
        <BackLink href="/pedidos" label="Pedidos" />
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nuevo pedido</h1>
        <CustomerPicker customers={customers} />
      </section>
    );
  }

  const today = todayInLima();
  const [routes, products, available, lastOrder, balances] = await Promise.all([
    listRoutes(),
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    availableByProduct(),
    lastOrderLines(customer.id),
    balancesByCustomer([customer.id]),
  ]);
  const route = routes.find((r) => r.id === customer.routeId)!;
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/pedidos" label="Pedidos" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Nuevo pedido</h1>
      <OrderForm
        key={customer.id}
        products={products}
        available={available}
        customer={{ id: customer.id, name: customer.name, routeName: route.name }}
        initial={{ deliveryOn: nextVisitDate(route.days, today), lines: [] }}
        lastOrder={lastOrder}
        today={today}
        account={{ balance: balances[customer.id] ?? 0, creditLimit: customer.creditLimit }}
      />
    </section>
  );
}
