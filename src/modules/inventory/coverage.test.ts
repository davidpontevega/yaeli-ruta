import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageDays, isLowCoverage, targetStock, weeklySales } from "./coverage";

test("no sales: no data, no target, not low", () => {
  assert.equal(weeklySales(0), null);
  assert.equal(coverageDays(5, 0), null);
  assert.equal(targetStock(0), 0);
  assert.equal(isLowCoverage(0, 0), false);
});

test("sold 35, stock 5: 9/week, 4 days, target 18, low", () => {
  assert.equal(weeklySales(35), 9);
  assert.equal(coverageDays(5, 35), 4);
  assert.equal(targetStock(35), 18);
  assert.equal(isLowCoverage(5, 35), true);
});

test("out of stock with sales: 0 days", () => {
  assert.equal(coverageDays(0, 35), 0);
  assert.equal(isLowCoverage(0, 35), true);
});

test("exactly 7 days is not low", () => {
  assert.equal(coverageDays(7, 28), 7);
  assert.equal(isLowCoverage(7, 28), false);
  assert.equal(isLowCoverage(6, 28), true);
});
