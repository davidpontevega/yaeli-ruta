"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { formatSoles } from "@/lib/money";
import type { SheetOrder } from "../queries";
import { addSheetOrder, deleteSheet, removeSheetOrder } from "../actions";

/** Orders of the sheet in visit order (Quitar), the route's orders in no sheet (Agregar), and delete. Buttons only while editable. */
export function SheetOrders({
  sheetId,
  editable,
  orders,
  candidates,
}: {
  sheetId: string;
  editable: boolean;
  orders: SheetOrder[];
  candidates: SheetOrder[];
}) {
  const [removeState, remove, removing] = useActionState(removeSheetOrder, undefined);
  const [addState, add, adding] = useActionState(addSheetOrder, undefined);
  const [deleteState, del, deleting] = useActionState(deleteSheet, undefined);
  const busy = removing || adding || deleting;
  const error = removeState?.error ?? addState?.error ?? deleteState?.error;

  const rows = (list: SheetOrder[], inSheet: boolean) => (
    <ul className="lista">
      {list.map((o, i) => (
        <li key={o.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={o.customerName} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{o.customerName}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {inSheet && <span className="chip bg-teal-50 text-teal-800">{i + 1}°</span>}
              <span className="chip bg-slate-100 text-slate-600">#{o.number}</span>
              <span className="chip bg-slate-100 text-slate-600">
                {o.lines} producto{o.lines === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <span className="cifra shrink-0">{formatSoles(o.total)}</span>
          {editable && (
            <form action={inSheet ? remove : add}>
              <input type="hidden" name="sheetId" value={sheetId} />
              <input type="hidden" name="orderId" value={o.id} />
              <button disabled={busy} className={`${inSheet ? "btn-secundario" : "btn-suave"} h-9 text-sm`}>
                {inSheet ? "Quitar" : "Agregar"}
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <h2 className="rotulo">Pedidos en orden de visita</h2>
      {orders.length ? rows(orders, true) : <p className="tarjeta text-sm text-muted">La hoja no tiene pedidos.</p>}
      {editable && candidates.length > 0 && (
        <>
          <h2 className="rotulo">Pedidos sin hoja</h2>
          {rows(candidates, false)}
        </>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {editable && (
        <form action={del} onSubmit={(e) => !confirm("¿Eliminar la hoja? Sus pedidos quedan sin hoja.") && e.preventDefault()}>
          <input type="hidden" name="sheetId" value={sheetId} />
          <button disabled={busy} className="h-12 w-full rounded-xl border border-red-300 text-red-600">
            Eliminar hoja
          </button>
        </form>
      )}
    </div>
  );
}
