import type { sheetStatusEnum } from "@/server/db/schema";

export type SheetStatus = (typeof sheetStatusEnum.enumValues)[number];

/** Current step of a sheet: 1 Armar, 2 Cargar, 3 Entregar, 4 Cerrar ruta, 5 done. `orders` = orders still on the sheet. */
export function sheetStep(status: SheetStatus, orders: number): 1 | 2 | 3 | 4 | 5 {
  if (status === "LIQUIDADA") return 5;
  if (status === "EN_RUTA") return orders > 0 ? 3 : 4;
  return orders > 0 ? 2 : 1;
}
