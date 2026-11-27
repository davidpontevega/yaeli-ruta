import { test } from "node:test";
import assert from "node:assert/strict";
import { orderText } from "./order-text";

const lines = [
  { quantity: 2, packagingName: "Caja", productName: "Arroz" },
  { quantity: 1, packagingName: "Saco", productName: "Azúcar" },
];

test("orderText: with number", () => {
  assert.equal(orderText(lines, 7), "Pedido #7 — Distribuidora Yaeli\n2 Caja · Arroz\n1 Saco · Azúcar");
});

test("orderText: without number", () => {
  assert.equal(orderText(lines), "Pedido — Distribuidora Yaeli\n2 Caja · Arroz\n1 Saco · Azúcar");
});

test("orderText: empty list is only the header", () => {
  assert.equal(orderText([]), "Pedido — Distribuidora Yaeli");
});
