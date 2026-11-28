import { test } from "node:test";
import assert from "node:assert/strict";
import { canSee, firstAllowed, menuKeyFor, sanitizeHidden } from "./menus";

test("menuKeyFor", () => {
  assert.equal(menuKeyFor("/"), "inicio");
  assert.equal(menuKeyFor("/productos/catalogo"), "catalogo");
  assert.equal(menuKeyFor("/productos/9/movimientos"), "productos");
  assert.equal(menuKeyFor("/precios"), "productos");
  assert.equal(menuKeyFor("/deudores/inicial"), "clientes");
  assert.equal(menuKeyFor("/catalogo"), "ajustes");
  assert.equal(menuKeyFor("/menus"), null);
  assert.equal(menuKeyFor("/api/x"), null);
  assert.equal(menuKeyFor("/productosx"), null);
  assert.equal(menuKeyFor("/stock?falta=1"), "stock");
  assert.equal(menuKeyFor("/reparto/9"), "pedidos");
  assert.equal(menuKeyFor("/mi-ruta"), "mi-ruta");
});

test("canSee", () => {
  assert.equal(canSee("/pedidos", "REPARTIDOR", []), false);
  assert.equal(canSee("/pedidos", "DUENO", []), true);
  assert.equal(canSee("/pedidos/nuevo", "DUENO", ["pedidos"]), false);
  assert.equal(canSee("/stock", "REPARTIDOR", []), true);
  assert.equal(canSee("/menus", "REPARTIDOR", ["inicio"]), true);
  assert.equal(canSee("/mi-ruta", "REPARTIDOR", []), true);
  assert.equal(canSee("/mi-ruta", "DUENO", ["mi-ruta"]), false);
});

test("firstAllowed", () => {
  assert.equal(firstAllowed("DUENO", []), "/");
  assert.equal(firstAllowed("DUENO", ["inicio"]), "/pedidos");
  assert.equal(firstAllowed("REPARTIDOR", ["inicio"]), "/mi-ruta");
  assert.equal(firstAllowed("REPARTIDOR", ["inicio", "mi-ruta"]), "/stock");
  assert.equal(firstAllowed("REPARTIDOR", ["inicio", "mi-ruta", "stock", "vencimientos", "productos"]), "/login");
});

test("sanitizeHidden", () => {
  assert.deepEqual(sanitizeHidden(["stock", "zzz", "stock"], "DUENO", false), { ok: true, hidden: ["stock"] });
  assert.deepEqual(sanitizeHidden(["pedidos", "stock"], "REPARTIDOR", false), { ok: true, hidden: ["stock"] });
  assert.deepEqual(sanitizeHidden(["ajustes", "inicio"], "DUENO", true), { ok: true, hidden: ["inicio"] });
  assert.deepEqual(sanitizeHidden(["ajustes"], "DUENO", false), { ok: true, hidden: ["ajustes"] });
  const all = ["inicio", "mi-ruta", "stock", "vencimientos", "productos"];
  assert.deepEqual(sanitizeHidden(all, "REPARTIDOR", false), { ok: false, error: "Deja al menos una pantalla" });
});
