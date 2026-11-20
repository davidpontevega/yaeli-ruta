import { z } from "zod";
import { requireUser } from "@/server/auth";
import { listRoutes } from "@/modules/customers";
import { todayInLima } from "@/modules/inventory";
import { defaultOrderDate } from "@/modules/orders";
import { listVehicles } from "@/modules/purchases";
import { SheetForm, SheetList, listSheets } from "@/modules/delivery";

export default async function DeliverySheetsPage({ searchParams }: PageProps<"/reparto">) {
  await requireUser("DUENO");
  const fecha = z.iso.date().safeParse((await searchParams).fecha);
  const date = fecha.success ? fecha.data : await defaultOrderDate();
  const [sheets, routes, vehicles] = await Promise.all([listSheets(date), listRoutes(), listVehicles()]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Reparto</h1>
      <SheetList date={date} sheets={sheets} />
      <SheetForm routes={routes} vehicles={vehicles} date={date} today={todayInLima()} />
    </section>
  );
}
