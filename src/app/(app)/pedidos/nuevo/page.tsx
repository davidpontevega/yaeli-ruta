import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listProducts } from "@/modules/catalog";
import { getCustomer, listCustomers, listRoutes, nextVisitDate } from "@/modules/customers";
import { todayInLima } from "@/modules/inventory";
import { CustomerPicker, OrderForm, availableByProduct, lastOrderLines } from "@/modules/orders";

export default async function NewOrderPage({ searchParams }: PageProps<"/pedidos/nuevo">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await searchParams).cliente);
  const customer = id.success ? await getCustomer(id.data) : null;

  if (!customer?.active) {
    const customers = await listCustomers({ q: "", routeId: "", includeInactive: false });
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Nuevo pedido</h1>
        <CustomerPicker customers={customers} />
      </section>
    );
  }

  const today = todayInLima();
  const [routes, products, available, lastOrder] = await Promise.all([
    listRoutes(),
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    availableByProduct(),
    lastOrderLines(customer.id),
  ]);
  const route = routes.find((r) => r.id === customer.routeId)!;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nuevo pedido</h1>
      <OrderForm
        key={customer.id}
        products={products}
        available={available}
        customer={{ id: customer.id, name: customer.name, routeName: route.name }}
        initial={{ deliveryOn: nextVisitDate(route.days, today), lines: [] }}
        lastOrder={lastOrder}
        today={today}
      />
    </section>
  );
}
