import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOQUEO_MS, MAX_INTENTOS, PIN_REGEX, hashPin, trasFallo, verificarPin } from "./pin";

test("hash y verificación de PIN", async () => {
  const h = await hashPin("1234");
  assert.notEqual(h, await hashPin("1234"), "sal distinta cada vez");
  assert.equal(await verificarPin("1234", h), true);
  assert.equal(await verificarPin("1235", h), false);
  assert.equal(await verificarPin("1234", "basura"), false);
});

test("formato de PIN", () => {
  for (const ok of ["1234", "123456"]) assert.ok(PIN_REGEX.test(ok));
  for (const mal of ["123", "1234567", "12a4", ""]) assert.ok(!PIN_REGEX.test(mal));
});

test("bloqueo tras MAX_INTENTOS fallos", () => {
  const ahora = new Date(0);
  assert.deepEqual(trasFallo(0, ahora), { intentosFallidos: 1, bloqueadoHasta: null });
  assert.deepEqual(trasFallo(MAX_INTENTOS - 1, ahora), { intentosFallidos: 0, bloqueadoHasta: new Date(BLOQUEO_MS) });
});
