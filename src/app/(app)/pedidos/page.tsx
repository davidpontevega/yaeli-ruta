import Link from "next/link";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listRoutes } from "@/modules/customers";
import { OrderFilters, OrderList, defaultOrderDate, listOrders } from "@/modules/orders";

export default async function OrdersPage({ searchParams }: PageProps<"/pedidos">) {
  await requireUser("DUENO");
  const sp = await searchParams;
  const date = z.iso.date().safeParse(sp.fecha);
  const filters = {
    date: date.success ? date.data : await defaultOrderDate(),
    routeId: typeof sp.ruta === "string" && z.uuid().safeParse(sp.ruta).success ? sp.ruta : "",
    includeCancelled: sp.anulados === "1",
  };
  const [orders, routes] = await Promise.all([listOrders(filters), listRoutes()]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Pedidos</h1>
        <Link href="/pedidos/nuevo" className="btn-primario flex h-10 items-center text-sm">
          + Nuevo
        </Link>
      </div>
      <OrderFilters {...filters} routes={routes} />
      <OrderList orders={orders} />
    </section>
  );
}
