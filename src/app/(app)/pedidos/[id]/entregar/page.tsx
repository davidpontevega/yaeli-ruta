import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { Avatar } from "@/components/ui/avatar";
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
      <BackLink href={`/pedidos/${order.id}`} label="pedido" />
      <div className="flex items-center gap-3">
        <Avatar name={customer?.name ?? "?"} />
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight md:text-[26px]">Entregar pedido #{order.number}</h1>
          <p className="truncate text-muted">{customer?.name}</p>
        </div>
      </div>
      <DeliveryForm
        orderId={order.id}
        balance={balances[order.customerId] ?? 0}
        items={order.items.map((i) => ({ ...i, stock: stock[i.productId] ?? 0 }))}
      />
    </section>
  );
}
