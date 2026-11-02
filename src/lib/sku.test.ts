import { test } from "node:test";
import assert from "node:assert/strict";
import { prefijoSku, siguienteSku } from "./sku";

test("prefijo desde la categoría", () => {
  assert.equal(prefijoSku("Galletas"), "GAL");
  assert.equal(prefijoSku("Cuidado del bebé"), "CUI");
  assert.equal(prefijoSku("Ñ"), "N");
  assert.equal(prefijoSku("123"), "PRO");
});

test("siguiente código", () => {
  assert.equal(siguienteSku("GAL", []), "GAL-001");
  assert.equal(siguienteSku("GAL", ["GAL-001", "GAL-007", "GOL-020", "GAL-X"]), "GAL-008");
});
