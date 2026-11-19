import { test } from "node:test";
import assert from "node:assert/strict";
import { paginateCatalog, splitLabel } from "./catalog-pages";

test("size taken from the end of the name", () => {
  assert.deepEqual(splitLabel("Aceite Cocinero 900 ml"), { title: "Aceite Cocinero", size: "900 ml" });
  assert.deepEqual(splitLabel("Gaseosa Inca Kola 1.5 L"), { title: "Gaseosa Inca Kola", size: "1.5 L" });
  assert.deepEqual(splitLabel("Galleta Soda Field 34g"), { title: "Galleta Soda Field", size: "34g" });
  assert.deepEqual(splitLabel("Yogurt Gloria x 12"), { title: "Yogurt Gloria", size: "x 12" });
  assert.deepEqual(splitLabel("Atún Florida 6 x 170 g"), { title: "Atún Florida", size: "6 x 170 g" });
  assert.deepEqual(splitLabel("Arroz Costeño 5 kg"), { title: "Arroz Costeño", size: "5 kg" });
  assert.deepEqual(splitLabel("Papel Higiénico Suave"), { title: "Papel Higiénico Suave", size: null });
  assert.deepEqual(splitLabel("Leche Gloria Light"), { title: "Leche Gloria Light", size: null });
  assert.deepEqual(splitLabel("900 ml"), { title: "900 ml", size: null });
});

// Names go K, J, I… so sorting by name reverses them.
const products = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Aceite ${String.fromCharCode(75 - i)} 1 L`, photoVersion: i }));

test("pages of 5, sorted by name, numbered and alternating", () => {
  assert.deepEqual(paginateCatalog([{ title: "Aceites", products: [] }]), []);
  assert.equal(paginateCatalog([{ title: "Aceites", products: products(5) }]).length, 1);

  const six = paginateCatalog([{ title: "Aceites", products: products(6) }]);
  assert.deepEqual(
    six.map((p) => [p.title, p.rows.length]),
    [
      ["Aceites", 5],
      ["Aceites (2)", 1],
    ],
  );
  assert.equal(six[0].rows[0].title, "Aceite F");
  assert.equal(six[0].rows[0].size, "1 L");
  assert.deepEqual(
    six[0].rows.map((r) => r.side),
    ["right", "left", "right", "left", "right"],
  );
  assert.equal(six[1].rows[0].side, "right"); // restarts on every page

  const many = paginateCatalog([
    { title: "Aceites", products: products(11) },
    { title: "Vacía", products: [] },
    { title: "Arroz", products: products(1) },
  ]);
  assert.deepEqual(
    many.map((p) => p.title),
    ["Aceites", "Aceites (2)", "Aceites (3)", "Arroz"],
  );
});
