// Deliveries saved on the phone without signal and waiting to be uploaded (spec 025). Pure: no IndexedDB, no fetch.
import { formatSoles } from "@/lib/money";
import type { PAYMENT_METHOD_IDS } from "@/lib/payment";
import type { RouteOrder, RouteSheet } from "./route-snapshot";

export type OfflineOp = {
  id: string;
  userId: string;
  sheetId: string;
  orderId: string;
  lines: { packagingId: string; delivered: number }[];
  paid: number; // céntimos
  method: (typeof PAYMENT_METHOD_IDS)[number];
  at: string; // ISO, when it was saved
  state: "pending" | "sent" | "rejected";
  reason?: string;
  // Only for the rejected card: the order may be gone from the sheet by then.
  customerName: string;
  orderNumber: number;
};

export type SyncResult = { id: string; result: "ok" | "duplicate" | "rejected"; reason?: string };

/** YYYY-MM-DD in Lima. */
export const limaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });

/** Total of what is delivered, at the order's prices (céntimos). */
export function deliveredTotal(order: RouteOrder, lines: OfflineOp["lines"]) {
  const qty = new Map(lines.map((l) => [l.packagingId, l.delivered]));
  return order.lines.reduce((s, l) => s + (qty.get(l.packagingId) ?? 0) * l.price, 0);
}

/** Same checks (and texts) as the server's delivery; null when it is valid. `debt` = what the customer owed before. */
export function validateOp(order: RouteOrder, debt: number, op: Pick<OfflineOp, "lines" | "paid">): string | null {
  const qty = new Map(op.lines.map((l) => [l.packagingId, l.delivered]));
  if (order.lines.length !== qty.size || order.lines.some((l) => !qty.has(l.packagingId))) return "El pedido cambió; recarga la página";
  const over = order.lines.find((l) => qty.get(l.packagingId)! > l.quantity);
  if (over) return `No puedes entregar más de lo pedido en ${over.product}`;
  if (order.lines.some((l) => qty.get(l.packagingId)! < 0)) return "Cantidad inválida";
  if (!order.lines.some((l) => qty.get(l.packagingId)! > 0)) return "No hay nada que entregar; anula el pedido";
  const maxPaid = Math.max(0, debt + deliveredTotal(order, op.lines));
  if (op.paid > maxPaid) return `Lo pagado no puede pasar de ${formatSoles(maxPaid)}`;
  return null;
}

/**
 * The sheets as they will be once the queue is uploaded: each op marks its order ENTREGADO and moves the customer's debt.
 * Only orders still PENDIENTE in the snapshot are touched, so a sheet downloaded after the upload is not counted twice. Rejected ops don't apply.
 */
export function applyQueue(sheets: RouteSheet[], ops: OfflineOp[]): RouteSheet[] {
  const byOrder = new Map(ops.filter((o) => o.state !== "rejected").map((o) => [o.orderId, o]));
  return sheets.map((s) => ({
    ...s,
    customers: s.customers.map((c) => {
      let debt = c.debt;
      const orders = c.orders.map((o) => {
        const op = byOrder.get(o.id);
        if (!op || o.status !== "PENDIENTE") return o;
        const total = deliveredTotal(o, op.lines);
        debt += total - op.paid;
        return {
          ...o,
          status: "ENTREGADO" as const,
          total,
          lines: o.lines.map((l) => ({ ...l, quantity: op.lines.find((x) => x.packagingId === l.packagingId)?.delivered ?? 0 })),
        };
      });
      return { ...c, debt, orders };
    }),
  }));
}

/** Server answers → ops: ok/duplicate are uploaded, rejected keep the reason. Ops without an answer stay as they were. */
export function applyResults(ops: OfflineOp[], results: SyncResult[]): OfflineOp[] {
  const of = new Map(results.map((r) => [r.id, r]));
  return ops.map((o) => {
    const r = of.get(o.id);
    if (!r) return o;
    return r.result === "rejected" ? { ...o, state: "rejected", reason: r.reason } : { ...o, state: "sent", reason: undefined };
  });
}

export const ownOps = (ops: OfflineOp[], userId: string) => ops.filter((o) => o.userId === userId);

/** Uploaded ops saved before `today` (YYYY-MM-DD, Lima): nothing left to show, can be deleted. */
export const staleSent = (ops: OfflineOp[], today: string) => ops.filter((o) => o.state === "sent" && limaDay(new Date(o.at)) < today);
