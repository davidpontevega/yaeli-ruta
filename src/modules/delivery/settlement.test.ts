import { test } from "node:test";
import assert from "node:assert/strict";
import { returnPlan } from "./settlement";

const o = (lotId: string, locationId: string, quantity: number) => ({ lotId, locationId, quantity });

test("one origin gets back what is left", () => {
  assert.deepEqual(returnPlan([{ lotId: "L1", quantity: 4 }], [o("L1", "p1", 10)]), [o("L1", "p1", 4)]);
});

test("a lot from two floors fills them in locationId order", () => {
  assert.deepEqual(returnPlan([{ lotId: "L1", quantity: 7 }], [o("L1", "p2", 5), o("L1", "p1", 5)]), [o("L1", "p1", 5), o("L1", "p2", 2)]);
});

test("more on the vehicle than the sheet took out: the excess stays", () => {
  assert.deepEqual(returnPlan([{ lotId: "L1", quantity: 12 }], [o("L1", "p1", 5)]), [o("L1", "p1", 5)]);
});

test("a vehicle lot without origin stays; an origin without vehicle stock returns nothing", () => {
  assert.deepEqual(returnPlan([{ lotId: "X", quantity: 3 }], [o("L1", "p1", 5)]), []);
});

test("nothing left (all delivered) and empty inputs", () => {
  assert.deepEqual(returnPlan([{ lotId: "L1", quantity: 0 }], [o("L1", "p1", 5)]), []);
  assert.deepEqual(returnPlan([], []), []);
});
