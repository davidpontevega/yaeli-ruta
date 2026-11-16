import { test } from "node:test";
import assert from "node:assert/strict";
import { available, defaultPackaging, mergeLine, orderTotal } from "./order-math";

test("total", () => {
  assert.equal(orderTotal([]), 0);
  assert.equal(
    orderTotal([
      { quantity: 2, price: 1250 },
      { quantity: 3, price: 100 },
    ]),
    2800,
  );
});

test("merge same packaging, capped", () => {
  const a = { packagingId: "a", quantity: 2 };
  assert.deepEqual(mergeLine([a], { packagingId: "b", quantity: 1 }), [a, { packagingId: "b", quantity: 1 }]);
  assert.deepEqual(mergeLine([a], { packagingId: "a", quantity: 3 }), [{ packagingId: "a", quantity: 5 }]);
  assert.equal(mergeLine([{ packagingId: "a", quantity: 9999 }], { packagingId: "a", quantity: 5 })[0].quantity, 10000);
});

test("available never negative", () => {
  assert.equal(available(100, 30), 70);
  assert.equal(available(10, 30), 0);
});

test("default packaging: biggest with price", () => {
  const und = { factor: 1, salePrice: 100 };
  const caja = { factor: 24, salePrice: 2200 };
  const fardo = { factor: 96, salePrice: 0 };
  assert.equal(defaultPackaging([und, fardo, caja]), caja);
  assert.equal(defaultPackaging([{ ...und, salePrice: 0 }, fardo]), fardo);
  assert.equal(defaultPackaging([]), undefined);
});
