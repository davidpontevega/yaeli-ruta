import { test } from "node:test";
import assert from "node:assert/strict";
import { applyQueue, applyResults, ownOps, staleSent, validateOp, type OfflineOp } from "./offline-queue";
import type { RouteOrder, RouteSheet } from "./route-snapshot";

const order: RouteOrder = {
  id: "o1",
  number: 10,
  status: "PENDIENTE",
  total: 2500,
  lines: [
    { packagingId: "k1", product: "Arroz", packaging: "saco", quantity: 2, price: 1000 },
    { packagingId: "k2", product: "Azúcar", packaging: "kilo", quantity: 1, price: 500 },
  ],
};
const sheet = (o: RouteOrder = order, debt = 300): RouteSheet => ({
  id: "s1",
  number: 7,
  status: "EN_RUTA",
  date: "2026-11-28",
  routeName: "Norte",
  vehicleName: "Moto",
  driverName: "Luis",
  customers: [{ id: "c1", name: "Bodega Ana", phone: null, address: null, reference: null, debt, orders: [o] }],
  load: { items: [], short: [], weightGrams: 0, noWeight: 0 },
});
const op = (x: Partial<OfflineOp> = {}): OfflineOp => ({
  id: "op1",
  userId: "u1",
  sheetId: "s1",
  orderId: "o1",
  lines: [
    { packagingId: "k1", delivered: 1 },
    { packagingId: "k2", delivered: 1 },
  ],
  paid: 500,
  method: "YAPE",
  at: "2026-11-28T15:00:00.000Z",
  state: "pending",
  customerName: "Bodega Ana",
  orderNumber: 10,
  ...x,
});

test("validateOp: same rules and texts as the server", () => {
  assert.equal(validateOp(order, 300, op()), null);
  assert.equal(
    validateOp(
      order,
      0,
      op({
        lines: [
          { packagingId: "k1", delivered: 3 },
          { packagingId: "k2", delivered: 0 },
        ],
      }),
    ),
    "No puedes entregar más de lo pedido en Arroz",
  );
  assert.equal(
    validateOp(
      order,
      0,
      op({
        lines: [
          { packagingId: "k1", delivered: 0 },
          { packagingId: "k2", delivered: 0 },
        ],
      }),
    ),
    "No hay nada que entregar; anula el pedido",
  );
  assert.equal(validateOp(order, 0, op({ lines: [{ packagingId: "k1", delivered: 1 }] })), "El pedido cambió; recarga la página");
  // Max paid = debt 300 + delivered 1500.
  assert.equal(validateOp(order, 300, op({ paid: 1800 })), null);
  assert.equal(validateOp(order, 300, op({ paid: 1801 })), "Lo pagado no puede pasar de S/ 18.00");
  assert.equal(validateOp(order, -2000, op({ paid: 1 })), "Lo pagado no puede pasar de S/ 0.00");
});

test("applyQueue: order delivered locally, debt += total − paid; rejected ops don't apply", () => {
  const [s] = applyQueue([sheet()], [op()]);
  const c = s.customers[0];
  assert.equal(c.debt, 300 + 1500 - 500);
  assert.equal(c.orders[0].status, "ENTREGADO");
  assert.equal(c.orders[0].total, 1500);
  assert.deepEqual(
    c.orders[0].lines.map((l) => l.quantity),
    [1, 1],
  );
  const [r] = applyQueue([sheet()], [op({ state: "rejected", reason: "x" })]);
  assert.equal(r.customers[0].debt, 300);
  assert.equal(r.customers[0].orders[0].status, "PENDIENTE");
});

test("applyQueue: a sheet downloaded after the upload is not counted twice", () => {
  const fresh = sheet({ ...order, status: "ENTREGADO", total: 1500 }, 1300);
  const [s] = applyQueue([fresh], [op({ state: "sent" })]);
  assert.equal(s.customers[0].debt, 1300);
});

test("applyResults: ok/duplicate → sent, rejected keeps reason, no answer → unchanged", () => {
  const ops = [op({ id: "a" }), op({ id: "b" }), op({ id: "c" }), op({ id: "d" })];
  const out = applyResults(ops, [
    { id: "a", result: "ok" },
    { id: "b", result: "duplicate" },
    { id: "c", result: "rejected", reason: "Esta hoja no es tuya" },
  ]);
  assert.deepEqual(
    out.map((o) => [o.id, o.state, o.reason]),
    [
      ["a", "sent", undefined],
      ["b", "sent", undefined],
      ["c", "rejected", "Esta hoja no es tuya"],
      ["d", "pending", undefined],
    ],
  );
});

test("ownOps and staleSent", () => {
  const ops = [
    op({ id: "a", state: "sent", at: "2026-11-28T04:00:00.000Z" }), // 27/11 23:00 in Lima
    op({ id: "b", state: "sent", at: "2026-11-28T06:00:00.000Z" }), // 28/11 in Lima
    op({ id: "c", state: "pending", at: "2026-11-20T06:00:00.000Z" }),
    op({ id: "d", userId: "u2" }),
  ];
  assert.deepEqual(
    ownOps(ops, "u1").map((o) => o.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    staleSent(ops, "2026-11-28").map((o) => o.id),
    ["a"],
  );
});
