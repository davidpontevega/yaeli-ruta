import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { listProducts } from "@/modules/catalog";
import { getCustomer, specialPriceMap, listRoutes } from "@/modules/customers";
import { todayInLima } from "@/modules/inventory";
import { balancesByCustomer } from "@/modules/accounts";
import { OrderForm, OrderSummary, availableByProduct, getOrder } from "@/modules/orders";

export default async function EditOrderPage({ params }: PageProps<"/pedidos/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const order = await getOrder(id.data);
  if (!order) notFound();
  const customer = (await getCustomer(order.customerId))!;

  // Closed, or loaded on a vehicle (sheet EN_RUTA): summary only; an order in route can still be delivered.
  const inRoute = order.status === "PENDIENTE" && order.sheet?.status === "EN_RUTA";
  if (order.status !== "PENDIENTE" || inRoute)
    return (
      <section className="flex flex-col gap-4">
        <BackLink href="/pedidos" label="Pedidos" />
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Pedido #{order.number}</h1>
        <OrderSummary order={order} customerName={customer.name} />
        {inRoute && (
          <Link href={`/pedidos/${order.id}/entregar`} className="btn-primario btn-entregar flex h-12 items-center justify-center">
            Entregar
          </Link>
        )}
      </section>
    );

  const [routes, products, available, balances, specialPrices] = await Promise.all([
    listRoutes(),
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    availableByProduct(order.id),
    balancesByCustomer([customer.id]),
    specialPriceMap(customer.id),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/pedidos" label="Pedidos" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Pedido #{order.number}</h1>
      <OrderForm
        products={products}
        available={available}
        customer={{ id: customer.id, name: customer.name, routeName: routes.find((r) => r.id === customer.routeId)?.name ?? "" }}
        initial={{ id: order.id, deliveryOn: order.deliveryOn, lines: order.items.map(({ packagingId, quantity }) => ({ packagingId, quantity })) }}
        lastOrder={null}
        today={todayInLima()}
        account={{ balance: balances[customer.id] ?? 0, creditLimit: customer.creditLimit }}
        specialPrices={specialPrices}
      />
    </section>
  );
}
