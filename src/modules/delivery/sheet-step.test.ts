import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetStep } from "./sheet-step";

test("sheetStep: each status and order count maps to its step", () => {
  assert.equal(sheetStep("PREPARANDO", 0), 1);
  assert.equal(sheetStep("PREPARANDO", 3), 2);
  assert.equal(sheetStep("EN_RUTA", 2), 3);
  assert.equal(sheetStep("EN_RUTA", 0), 4);
  assert.equal(sheetStep("LIQUIDADA", 0), 5);
});
