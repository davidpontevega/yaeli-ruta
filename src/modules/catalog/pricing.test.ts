import { test } from "node:test";
import assert from "node:assert/strict";
import { needsReview, priceUnitCost, realMarginPct, suggestedPrice } from "./pricing";

test("priceUnitCost: last cost first, then average, else null", () => {
  assert.equal(priceUnitCost(63, 60), 63);
  assert.equal(priceUnitCost(0, 60), 60);
  assert.equal(priceUnitCost(0, 0), null);
});

test("suggestedPrice rounds UP to 10 céntimos", () => {
  // caja ×96 at 63 c/u, 15% → 6955.2 → 6960
  assert.equal(suggestedPrice(63, 96, 15), 6960);
  // unit at 43 c, 15% → 49.45 → 50
  assert.equal(suggestedPrice(43, 1, 15), 50);
  // exact multiple stays: 100 × 1.2 = 120
  assert.equal(suggestedPrice(100, 1, 20), 120);
  // float noise: 70 × 1.1 = 77.00000000000001 → 80, not 90
  assert.equal(suggestedPrice(70, 1, 10), 80);
  assert.equal(suggestedPrice(null, 12, 15), null);
});

test("realMarginPct", () => {
  assert.equal(realMarginPct(7000, 63, 96), 16); // 7000 vs 6048
  assert.equal(realMarginPct(6048, 63, 96), 0);
  assert.equal(realMarginPct(5000, 63, 96), -17);
  assert.equal(realMarginPct(100, null, 1), null);
});

test("needsReview ignores cost-rounding noise, flags real rises", () => {
  // S/ 60 box ×96 → 63 c/u (rounded up from 62.5); price 69.00 = 14.1% over 60.48: noise, not flagged
  assert.equal(needsReview(6900, 63, 96, 15), false);
  // cost rose to 75 c/u: 70.00 vs 72.00 cost → flagged
  assert.equal(needsReview(7000, 75, 96, 15), true);
  assert.equal(needsReview(100, null, 1, 15), false);
});
