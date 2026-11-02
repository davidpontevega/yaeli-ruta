import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSoles, parseSoles, toSolesInput } from "./money";

test("parseSoles", () => {
  assert.equal(parseSoles("2.5"), 250);
  assert.equal(parseSoles("2,05"), 205);
  assert.equal(parseSoles("S/ 10"), 1000);
  assert.equal(parseSoles("0.99"), 99);
  for (const mal of ["", "-1", "1.234", "abc", "1.2.3"]) assert.equal(parseSoles(mal), null, mal);
});

test("formatSoles", () => {
  assert.equal(formatSoles(250), "S/ 2.50");
  assert.equal(formatSoles(5), "S/ 0.05");
  assert.equal(formatSoles(-1999), "-S/ 19.99");
  assert.equal(toSolesInput(205), "2.05");
});
