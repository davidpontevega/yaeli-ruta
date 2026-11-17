import { test } from "node:test";
import assert from "node:assert/strict";
import { biggestPackaging, landedUnitCost, lineWeight, listVersion, missingToOrder, purchaseTotals } from "./purchase-math";

test("line weight", () => {
  assert.equal(lineWeight({ quantity: 6, weightGrams: 12500 }), 75000);
  assert.equal(lineWeight({ quantity: 6, weightGrams: null }), null);
});

test("totals", () => {
  const t = purchaseTotals([
    { quantity: 6, cost: 6510, freight: 2400, weightGrams: 12500 },
    { quantity: 20, cost: 2439, freight: 3000, weightGrams: null },
  ]);
  assert.deepEqual(t, { goods: 39060 + 48780, freight: 5400, total: 39060 + 48780 + 5400, weight: 75000, noWeight: 1 });
});

test("landed cost spreads the line freight", () => {
  assert.equal(landedUnitCost(6500, 2400, 6), 6900);
  assert.equal(landedUnitCost(1000, 100, 3), 1033);
  assert.equal(landedUnitCost(1000, 0, 3), 1000);
});

test("missing to order", () => {
  assert.equal(missingToOrder(20, 30, 12), 1); // 10 missing → 1 box
  assert.equal(missingToOrder(0, 30, 12), 3); // 30 → 2.5 → 3
  assert.equal(missingToOrder(0, 0, 12), 1); // out, no minimum
  assert.equal(missingToOrder(40, 30, 12), 0);
});

test("biggest packaging", () => {
  assert.equal(biggestPackaging([]), undefined);
  const a = { id: "a", factor: 12 };
  assert.equal(biggestPackaging([{ id: "u", factor: 1 }, a, { id: "b", factor: 12 }]), a);
});

test("list version", () => {
  assert.equal(listVersion(["b", "a"]), listVersion(["a", "b"]));
  assert.notEqual(listVersion(["a", "b"]), listVersion(["a", "b", "c"]));
  assert.equal(listVersion([]), "");
});
