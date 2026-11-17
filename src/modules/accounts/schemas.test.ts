import { test } from "node:test";
import assert from "node:assert/strict";
import { statementPeriodSchema } from "./schemas";

const period = statementPeriodSchema("2026-11-17", "2026-10-18");
const def = { from: "2026-10-18", to: "2026-11-17" };

test("statement period: default and valid", () => {
  assert.deepEqual(period.parse({}), def);
  assert.deepEqual(period.parse({ desde: "2026-08-01" }), { from: "2026-08-01", to: "2026-11-17" });
  assert.deepEqual(period.parse({ desde: "2026-08-01", hasta: "2026-08-31" }), { from: "2026-08-01", to: "2026-08-31" });
});

test("statement period: invalid → default", () => {
  assert.deepEqual(period.parse({ desde: "ayer" }), def);
  assert.deepEqual(period.parse({ desde: "2026-02-30" }), def);
  assert.deepEqual(period.parse({ desde: ["2026-08-01", "2026-08-02"] }), def);
  assert.deepEqual(period.parse({ desde: "2026-11-10", hasta: "2026-11-01" }), def);
  assert.deepEqual(period.parse({ hasta: "2026-11-18" }), def);
});
