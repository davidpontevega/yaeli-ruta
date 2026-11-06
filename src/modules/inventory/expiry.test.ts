import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysUntil, expiryBucket, todayInLima } from "./expiry";

test("todayInLima: 02:00 UTC is still the previous day in Lima (UTC-5)", () => {
  assert.equal(todayInLima(new Date("2026-11-07T02:00:00Z")), "2026-11-06");
  assert.equal(todayInLima(new Date("2026-11-07T06:00:00Z")), "2026-11-07");
});

test("daysUntil", () => {
  assert.equal(daysUntil("2026-11-06", "2026-11-06"), 0);
  assert.equal(daysUntil("2026-12-06", "2026-11-06"), 30);
  assert.equal(daysUntil("2026-11-01", "2026-11-06"), -5);
  assert.equal(daysUntil("2027-03-01", "2027-02-27"), 2); // across month end
});

test("expiryBucket edges", () => {
  assert.equal(expiryBucket(-1), "expired");
  assert.equal(expiryBucket(0), "30");
  assert.equal(expiryBucket(30), "30");
  assert.equal(expiryBucket(31), "60");
  assert.equal(expiryBucket(60), "60");
  assert.equal(expiryBucket(61), "90");
  assert.equal(expiryBucket(90), "90");
  assert.equal(expiryBucket(91), null);
});

test("addDays", () => {
  assert.equal(addDays("2026-11-06", 90), "2027-02-04");
  assert.equal(addDays("2026-11-06", -5), "2026-11-01");
});
