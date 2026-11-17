import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStatement, debtSince } from "./account-math";

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

test("statement: empty and everything before the period", () => {
  assert.deepEqual(buildStatement([], "2026-02-01", "2026-02-28"), { opening: 0, charges: 0, payments: 0, adjustments: 0, closing: 0, rows: [] });
  const s = buildStatement([{ type: "SALDO_INICIAL", amount: 1000, date: "2026-01-01" }], "2026-02-01", "2026-02-28");
  assert.equal(s.opening, 1000);
  assert.equal(s.closing, 1000);
  assert.equal(s.rows.length, 0);
});

test("statement: edges count, after `to` does not, negative adjustment, identity", () => {
  const s = buildStatement(
    [
      { type: "SALDO_INICIAL", amount: 10000, date: "2026-01-15" },
      { type: "CARGO", amount: 5000, date: "2026-02-01" },
      { type: "ABONO", amount: -3000, date: "2026-02-10" },
      { type: "AJUSTE", amount: -500, date: "2026-02-28" },
      { type: "CARGO", amount: 9999, date: "2026-03-01" },
    ],
    "2026-02-01",
    "2026-02-28",
  );
  assert.equal(s.opening, 10000);
  assert.equal(s.charges, 5000);
  assert.equal(s.payments, 3000);
  assert.equal(s.adjustments, -500);
  assert.equal(s.closing, 11500);
  assert.equal(s.opening + s.charges - s.payments + s.adjustments, s.closing);
  assert.deepEqual(
    s.rows.map((r) => r.balance),
    [15000, 12000, 11500],
  );
});
