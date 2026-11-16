import { test } from "node:test";
import assert from "node:assert/strict";
import { formatKg, parseKg, toKgInput } from "./weight";

test("parseKg", () => {
  assert.equal(parseKg("12.5"), 12500);
  assert.equal(parseKg("12,5"), 12500);
  assert.equal(parseKg("0.250"), 250);
  assert.equal(parseKg("1000"), 1_000_000);
  assert.equal(parseKg(""), null);
  assert.equal(parseKg("0"), undefined);
  assert.equal(parseKg("1000.001"), undefined);
  assert.equal(parseKg("1.2345"), undefined);
  assert.equal(parseKg("abc"), undefined);
});

test("formatKg and input", () => {
  assert.equal(formatKg(12500), "12.5 kg");
  assert.equal(formatKg(250), "0.25 kg");
  assert.equal(toKgInput(12500), "12.5");
  assert.equal(toKgInput(null), "");
});
