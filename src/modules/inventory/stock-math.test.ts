import { test } from "node:test";
import assert from "node:assert/strict";
import { splitByPackaging, toBaseUnits, weightedAverageCost } from "./stock-math";

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

test("splitByPackaging: largest first with remainder", () => {
  const packs = [
    { name: "unidad", factor: 1 },
    { name: "caja", factor: 96 },
    { name: "display", factor: 12 },
  ];
  assert.deepEqual(splitByPackaging(197, packs), [
    { name: "caja", count: 2 },
    { name: "unidad", count: 5 },
  ]);
  assert.deepEqual(splitByPackaging(25, packs), [
    { name: "display", count: 2 },
    { name: "unidad", count: 1 },
  ]);
  assert.deepEqual(splitByPackaging(0, packs), []);
});
