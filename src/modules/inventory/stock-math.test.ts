import { test } from "node:test";
import assert from "node:assert/strict";
import { toBaseUnits, weightedAverageCost } from "./stock-math";

test("toBaseUnits", () => {
  assert.equal(toBaseUnits(2, 96), 192);
  assert.equal(toBaseUnits(5, 1), 5);
});

test("weightedAverageCost: no previous stock takes incoming cost", () => {
  assert.equal(weightedAverageCost(0, 999, 192, 6000 / 96), 63);
});

test("weightedAverageCost: weighted by quantity", () => {
  // 100 u at 50 + 100 u at 70 → 60
  assert.equal(weightedAverageCost(100, 50, 100, 70), 60);
  // 300 u at 40 + 100 u at 80 → 50
  assert.equal(weightedAverageCost(300, 40, 100, 80), 50);
});
