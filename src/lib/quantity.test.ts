import { test } from "node:test";
import assert from "node:assert/strict";
import { splitByPackaging, stockStatus } from "./quantity";

test("splitByPackaging: largest first with remainder", () => {
  const packs = [
    { name: "unidad", factor: 1 },
    { name: "caja", factor: 96 },
    { name: "display", factor: 12 },
  ];
  assert.deepEqual(splitByPackaging(197, packs), [
    { name: "caja", count: 2 },
    { name: "unidad", count: 5 },
  ]);
  assert.deepEqual(splitByPackaging(25, packs), [
    { name: "display", count: 2 },
    { name: "unidad", count: 1 },
  ]);
  assert.deepEqual(splitByPackaging(0, packs), []);
});

test("stockStatus", () => {
  assert.equal(stockStatus(0, 10), "out");
  assert.equal(stockStatus(0, 0), "out");
  assert.equal(stockStatus(9, 10), "low");
  assert.equal(stockStatus(10, 10), "ok");
  assert.equal(stockStatus(5, 0), "ok");
});
