import { test } from "node:test";
import assert from "node:assert/strict";
import { waNumber } from "./phone";

test("waNumber adds 51 to a 9-digit mobile only", () => {
  assert.equal(waNumber("987654321"), "51987654321");
  assert.equal(waNumber("987 654 321"), "51987654321");
  assert.equal(waNumber("+51 987 654 321"), "51987654321");
});
