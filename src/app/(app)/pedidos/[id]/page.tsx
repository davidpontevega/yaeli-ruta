import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listProducts } from "@/modules/catalog";
import { getCustomer, listRoutes } from "@/modules/customers";
import { todayInLima } from "@/modules/inventory";
import { OrderForm, OrderSummary, availableByProduct, getOrder } from "@/modules/orders";

export default async function EditOrderPage({ params }: PageProps<"/pedidos/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const order = await getOrder(id.data);
  if (!order) notFound();
  const customer = (await getCustomer(order.customerId))!;

  if (order.status !== "PENDIENTE")
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Pedido #{order.number}</h1>
        <OrderSummary order={order} customerName={customer.name} />
      </section>
    );

  const [routes, products, available] = await Promise.all([
    listRoutes(),
    listProducts({ q: "", categoryId: "", includeInactive: false }),
    availableByProduct(order.id),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Pedido #{order.number}</h1>
      <OrderForm
        products={products}
        available={available}
        customer={{ id: customer.id, name: customer.name, routeName: routes.find((r) => r.id === customer.routeId)?.name ?? "" }}
        initial={{ id: order.id, deliveryOn: order.deliveryOn, lines: order.items.map(({ packagingId, quantity }) => ({ packagingId, quantity })) }}
        lastOrder={null}
        today={todayInLima()}
      />
    </section>
  );
}
