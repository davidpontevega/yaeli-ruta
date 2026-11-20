import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { PickingList, SheetOrders, getPicking, getSheet } from "@/modules/delivery";

export default async function DeliverySheetPage({ params }: PageProps<"/reparto/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [sheet, picking] = await Promise.all([getSheet(id.data), getPicking(id.data)]);
  if (!sheet) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href={`/reparto?fecha=${sheet.date}`} label="Reparto" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px] print:hidden">Hoja de ruta #{sheet.number}</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SheetOrders sheetId={sheet.id} editable={sheet.status === "PREPARANDO"} orders={sheet.orders} candidates={sheet.candidates} />
        <PickingList sheet={sheet} picking={picking} />
      </div>
    </section>
  );
}
