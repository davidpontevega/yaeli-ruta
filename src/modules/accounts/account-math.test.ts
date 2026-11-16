import { test } from "node:test";
import assert from "node:assert/strict";
import { debtSince } from "./account-math";

test("nothing owed", () => {
  assert.equal(debtSince([]), null);
  assert.equal(
    debtSince([
      { amount: 1000, date: "2026-01-01" },
      { amount: -1000, date: "2026-01-05" },
    ]),
    null,
  );
});

test("payments go to the oldest charge first", () => {
  const m = [
    { amount: 1000, date: "2026-01-01" },
    { amount: 500, date: "2026-02-01" },
    { amount: -800, date: "2026-02-10" },
  ];
  assert.equal(debtSince(m), "2026-01-01"); // 200 of January still open
  assert.equal(debtSince([...m, { amount: -200, date: "2026-02-11" }]), "2026-02-01");
});

test("negative adjustment acts as a payment; credit covers later charges", () => {
  assert.equal(
    debtSince([
      { amount: -300, date: "2026-01-01" },
      { amount: 300, date: "2026-01-02" },
      { amount: 100, date: "2026-01-03" },
    ]),
    "2026-01-03",
  );
});
