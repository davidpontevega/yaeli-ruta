import "server-only";
import { asc, eq } from "drizzle-orm";
import { audit, type Tx } from "@/server/db";
import { deliverySheets, orderItems, orders, packagings, products } from "@/server/db/schema";
import { dispatchStock, toBaseUnits } from "@/modules/inventory";
import { addCharge, addPayment, lockedBalance } from "@/modules/accounts";
import { formatSoles } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import type { PaymentMethod } from "@/server/db/schema";

/** Delivery sheet of the order (read without locking it; the caller already locked the order). */
export async function sheetOf(tx: Tx, sheetId: string | null) {
  if (!sheetId) return undefined;
  const [s] = await tx
    .select({ number: deliverySheets.number, status: deliverySheets.status, vehicleId: deliverySheets.vehicleId })
    .from(deliverySheets)
    .where(eq(deliverySheets.id, sheetId));
  return s;
}

/** Thrown inside the delivery transaction so nothing is saved; the message is shown to the user. */
export class DeliveryError extends Error {}

export type DeliveryInput = { orderId: string; lines: { packagingId: string; delivered: number }[]; paid: number; method: PaymentMethod };

/**
 * Delivers an order inside the caller's transaction: stock out (from the vehicle when its sheet is EN_RUTA), charge, payment and audit.
 * Throws DeliveryError (caller rolls back). `extra` is added to the audit details.
 */
export async function deliverInTx(tx: Tx, { orderId, lines, paid, method }: DeliveryInput, actorId: string, extra?: Record<string, unknown>) {
  const deliveredOf = new Map(lines.map((l) => [l.packagingId, l.delivered]));
  let routeSheetId: string | undefined; // sheet EN_RUTA of the order: the payment belongs to it
  const [o] = await tx
    .select({ status: orders.status, customerId: orders.customerId, number: orders.number, sheetId: orders.sheetId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (!o) throw new DeliveryError("El pedido no existe");
  if (o.status !== "PENDIENTE") throw new DeliveryError("El pedido ya no está pendiente");
  // In a sheet EN_RUTA the goods are on the vehicle: dispatch from it. Otherwise from the warehouse floors.
  const sheet = await sheetOf(tx, o.sheetId);
  const fromId = sheet?.status === "EN_RUTA" ? sheet.vehicleId : undefined;
  if (fromId) routeSheetId = o.sheetId!;
  const items = await tx
    .select({
      id: orderItems.id,
      packagingId: orderItems.packagingId,
      quantity: orderItems.quantity,
      price: orderItems.price,
      factor: packagings.factor,
      productId: packagings.productId,
      productName: products.name,
    })
    .from(orderItems)
    .innerJoin(packagings, eq(packagings.id, orderItems.packagingId))
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(eq(orderItems.orderId, orderId));
  if (items.length !== deliveredOf.size || items.some((i) => !deliveredOf.has(i.packagingId)))
    throw new DeliveryError("El pedido cambió; recarga la página");
  const delivered = items.map((i) => ({ ...i, delivered: deliveredOf.get(i.packagingId)! }));
  const over = delivered.find((i) => i.delivered > i.quantity);
  if (over) throw new DeliveryError(`No puedes entregar más de lo pedido en ${over.productName}`);
  const total = delivered.reduce((s, i) => s + i.delivered * i.price, 0);
  if (!delivered.some((i) => i.delivered > 0)) throw new DeliveryError("No hay nada que entregar; anula el pedido");

  // Base units per product, dispatched in product id order (same lock order as receiveGoods).
  const perProduct = new Map<string, { qty: number; name: string }>();
  for (const i of delivered) {
    const p = perProduct.get(i.productId) ?? { qty: 0, name: i.productName };
    p.qty += toBaseUnits(i.delivered, i.factor);
    perProduct.set(i.productId, p);
  }
  for (const [productId, p] of [...perProduct].sort(([a], [b]) => a.localeCompare(b))) {
    if (!p.qty) continue;
    const r = await dispatchStock(tx, { productId, baseQty: p.qty, orderId, userId: actorId, fromId });
    if (!r.ok) {
      const packs = await tx
        .select({ name: packagings.name, factor: packagings.factor })
        .from(packagings)
        .where(eq(packagings.productId, productId))
        .orderBy(asc(packagings.factor));
      throw new DeliveryError(`Falta stock de ${p.name}${fromId ? " en el vehículo" : ""}: hay ${r.available ? formatQty(r.available, packs) : "0"}`);
    }
  }

  for (const i of delivered) await tx.update(orderItems).set({ delivered: i.delivered }).where(eq(orderItems.id, i.id));
  await tx.update(orders).set({ status: "ENTREGADO", total, deliveredAt: new Date() }).where(eq(orders.id, orderId));

  const balance = (await lockedBalance(tx, o.customerId)) ?? 0;
  const maxPaid = Math.max(0, balance + total);
  if (paid > maxPaid) throw new DeliveryError(`Lo pagado no puede pasar de ${formatSoles(maxPaid)}`);
  if (total > 0) await addCharge(tx, { customerId: o.customerId, orderId, amount: total, userId: actorId });
  if (paid > 0) await addPayment(tx, { customerId: o.customerId, amount: paid, method, userId: actorId, sheetId: routeSheetId });
  await audit(tx, {
    actorId,
    action: "order.deliver",
    entity: "order",
    entityId: orderId,
    details: { total, paid, method: paid ? method : null, ...extra },
  });
  return { routeSheetId };
}
