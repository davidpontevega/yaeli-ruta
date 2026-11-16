import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getCustomer } from "@/modules/customers";
import { warehouseStockByProduct } from "@/modules/inventory";
import { balancesByCustomer } from "@/modules/accounts";
import { DeliveryForm, getOrder } from "@/modules/orders";

export default async function DeliverOrderPage({ params }: PageProps<"/pedidos/[id]/entregar">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const order = await getOrder(id.data);
  if (!order) notFound();
  if (order.status !== "PENDIENTE") redirect(`/pedidos/${order.id}`);
  const [customer, stock, balances] = await Promise.all([
    getCustomer(order.customerId),
    warehouseStockByProduct(),
    balancesByCustomer([order.customerId]),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        Entregar pedido #{order.number} <span className="block text-base font-normal text-muted">{customer?.name}</span>
      </h1>
      <DeliveryForm
        orderId={order.id}
        balance={balances[order.customerId] ?? 0}
        items={order.items.map((i) => ({ ...i, stock: stock[i.productId] ?? 0 }))}
      />
    </section>
  );
}
