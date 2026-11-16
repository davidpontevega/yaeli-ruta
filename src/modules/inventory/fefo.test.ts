import { test } from "node:test";
import assert from "node:assert/strict";
import { fefoPick, type StockLot } from "./fefo";

const lot = (lotId: string, locationName: string, expiresOn: string | null, quantity: number): StockLot => ({
  lotId,
  locationId: locationName,
  locationName,
  expiresOn,
  quantity,
});

test("earliest expiry first, no date last, then location", () => {
  const lots = [
    lot("nodate", "Piso 1", null, 100),
    lot("late", "Piso 1", "2027-05-01", 10),
    lot("early", "Piso 2", "2027-01-01", 5),
    lot("early", "Piso 1", "2027-01-01", 3),
  ];
  assert.deepEqual(fefoPick(lots, 20), [
    { lotId: "early", locationId: "Piso 1", quantity: 3 },
    { lotId: "early", locationId: "Piso 2", quantity: 5 },
    { lotId: "late", locationId: "Piso 1", quantity: 10 },
    { lotId: "nodate", locationId: "Piso 1", quantity: 2 },
  ]);
});

test("short stock and zero rows", () => {
  assert.equal(fefoPick([lot("a", "P", null, 5)], 6), null);
  assert.deepEqual(fefoPick([lot("a", "P", null, 0), lot("b", "P", null, 5)], 5), [{ lotId: "b", locationId: "P", quantity: 5 }]);
  assert.deepEqual(fefoPick([], 0), []);
});
