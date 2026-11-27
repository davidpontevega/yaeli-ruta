import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import {
  LoadActions,
  PickingList,
  SettlementPanel,
  SheetOrders,
  SheetStepper,
  getPicking,
  getSettlement,
  getSheet,
  sheetStep,
} from "@/modules/delivery";

export default async function DeliverySheetPage({ params }: PageProps<"/reparto/[id]">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [sheet, picking, settlement] = await Promise.all([getSheet(id.data), getPicking(id.data), getSettlement(id.data)]);
  if (!sheet) notFound();
  return (
    <section className="flex flex-col gap-4">
      <BackLink href={`/reparto?fecha=${sheet.date}`} label="Reparto" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px] print:hidden">Hoja de ruta #{sheet.number}</h1>
      <SheetStepper step={sheetStep(sheet.status, sheet.orders.length)} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {sheet.status === "LIQUIDADA" && <SettlementPanel sheetId={sheet.id} status="LIQUIDADA" pending={[]} settlement={settlement} />}
        {sheet.status === "PREPARANDO" && (
          <>
            <SheetOrders sheetId={sheet.id} editable orders={sheet.orders} candidates={sheet.candidates} />
            <div className="flex flex-col gap-3">
              {sheet.orders.length > 0 && <LoadActions key={sheet.status} sheetId={sheet.id} status={sheet.status} short={picking.short.length} />}
              <PickingList sheet={sheet} picking={picking} />
            </div>
          </>
        )}
        {/* On the road: closing the route comes first; the load and "Devolver al almacén" stay one tap away. */}
        {sheet.status === "EN_RUTA" && (
          <>
            <SettlementPanel sheetId={sheet.id} status="EN_RUTA" pending={sheet.orders} settlement={settlement} />
            {/* A closed <details> doesn't print: the load list prints from this copy. */}
            <div className="hidden print:block">
              <PickingList sheet={sheet} picking={picking} />
            </div>
            <details className="tarjeta print:hidden">
              <summary className="cursor-pointer text-sm font-semibold text-primary">Ver carga del vehículo</summary>
              <div className="mt-3 flex flex-col gap-3">
                <PickingList sheet={sheet} picking={picking} />
                <LoadActions key={sheet.status} sheetId={sheet.id} status={sheet.status} short={picking.short.length} />
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
