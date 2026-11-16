import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDays, nextVisitDate } from "./route-days";

test("format days in week order", () => {
  assert.equal(formatDays([4, 1]), "Lun · Jue");
  assert.equal(formatDays([7]), "Dom");
});

test("next visit is strictly after today", () => {
  // 2026-11-16 is a Monday
  assert.equal(nextVisitDate([1, 4], "2026-11-16"), "2026-11-19");
  assert.equal(nextVisitDate([1], "2026-11-16"), "2026-11-23");
  assert.equal(nextVisitDate([7], "2026-11-21"), "2026-11-22");
  assert.equal(nextVisitDate([2], "2026-12-31"), "2027-01-05");
});
