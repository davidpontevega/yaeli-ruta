import { test } from "node:test";
import assert from "node:assert/strict";
import { skuPrefix, nextSku } from "./sku";

test("prefix from category", () => {
  assert.equal(skuPrefix("Galletas"), "GAL");
  assert.equal(skuPrefix("Cuidado del bebé"), "CUI");
  assert.equal(skuPrefix("Ñ"), "N");
  assert.equal(skuPrefix("123"), "PRO");
});

test("next code", () => {
  assert.equal(nextSku("GAL", []), "GAL-001");
  assert.equal(nextSku("GAL", ["GAL-001", "GAL-007", "GOL-020", "GAL-X"]), "GAL-008");
});
