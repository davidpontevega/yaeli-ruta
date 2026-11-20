import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPicking } from "./picking";

const line = (productId: string, quantity: number, factor = 1, weightGrams: number | null = null) => ({
  productId,
  productName: productId === "a" ? "Arroz" : "Bebida",
  quantity,
  factor,
  weightGrams,
});
const lot = (productId: string, lotId: string, locationName: string, expiresOn: string | null, quantity: number) => ({
  productId,
  lotId,
  locationId: locationName,
  locationName,
  expiresOn,
  quantity,
});

test("sums the same product across orders and packagings", () => {
  const p = buildPicking([line("a", 2, 12), line("a", 5)], [lot("a", "l1", "Piso 1", "2027-01-01", 100)]);
  assert.deepEqual(p.floors, [
    {
      locationId: "Piso 1",
      locationName: "Piso 1",
      items: [{ productId: "a", productName: "Arroz", lotId: "l1", expiresOn: "2027-01-01", baseQty: 29 }],
    },
  ]);
  assert.deepEqual(p.short, []);
});

test("splits over 2 lots by expiry, no date last", () => {
  const p = buildPicking(
    [line("a", 15)],
    [lot("a", "l3", "Piso 1", null, 50), lot("a", "l2", "Piso 2", "2027-06-01", 10), lot("a", "l1", "Piso 1", "2027-01-01", 3)],
  );
  assert.deepEqual(
    p.floors.map((f) => [f.locationName, f.items.map((i) => [i.lotId, i.expiresOn, i.baseQty])]),
    [
      [
        "Piso 1",
        [
          ["l1", "2027-01-01", 3],
          ["l3", null, 2],
        ],
      ],
      ["Piso 2", [["l2", "2027-06-01", 10]]],
    ],
  );
});

test("same expiry: the floor first by name", () => {
  const p = buildPicking([line("a", 4)], [lot("a", "x", "Piso 2", "2027-01-01", 10), lot("a", "y", "Piso 1", "2027-01-01", 10)]);
  assert.deepEqual(
    p.floors.map((f) => [f.locationName, f.items.map((i) => i.lotId)]),
    [["Piso 1", ["y"]]],
  );
});

test("same lot on 2 floors = 2 items", () => {
  const p = buildPicking([line("a", 8)], [lot("a", "l1", "Piso 1", "2027-01-01", 5), lot("a", "l1", "Piso 2", "2027-01-01", 5)]);
  assert.deepEqual(
    p.floors.map((f) => [f.locationName, f.items.map((i) => [i.lotId, i.baseQty])]),
    [
      ["Piso 1", [["l1", 5]]],
      ["Piso 2", [["l1", 3]]],
    ],
  );
});

test("floors and products sorted by name", () => {
  const p = buildPicking(
    [line("b", 1), line("a", 1)],
    [lot("b", "b1", "Piso 2", null, 5), lot("a", "a1", "Piso 2", null, 5), lot("a", "a2", "Piso 1", "2026-01-01", 0)],
  );
  assert.deepEqual(
    p.floors.map((f) => [f.locationName, f.items.map((i) => i.productName)]),
    [["Piso 2", ["Arroz", "Bebida"]]],
  );
});

test("short stock: picks what there is and reports the rest", () => {
  const p = buildPicking([line("a", 2, 12)], [lot("a", "l1", "Piso 1", null, 20)]);
  assert.equal(p.floors[0].items[0].baseQty, 20);
  assert.equal(p.floors[0].items[0].lotId, "l1");
  assert.deepEqual(p.short, [{ productId: "a", productName: "Arroz", missing: 4 }]);
});

test("no stock: all missing", () => {
  const p = buildPicking([line("b", 3)], []);
  assert.deepEqual(p.floors, []);
  assert.deepEqual(p.short, [{ productId: "b", productName: "Bebida", missing: 3 }]);
});

test("weight with lines without weight", () => {
  const p = buildPicking([line("a", 2, 12, 5000), line("b", 3, 1, null)], []);
  assert.deepEqual(p.weight, { grams: 10000, noWeight: 1 });
});

test("no lines", () => {
  assert.deepEqual(buildPicking([], [lot("a", "l1", "Piso 1", null, 5)]), { floors: [], short: [], weight: { grams: 0, noWeight: 0 } });
});
