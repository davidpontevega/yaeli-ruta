import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_MS, MAX_ATTEMPTS, PIN_REGEX, afterFailedAttempt, hashPin, verifyPin } from "./pin";

test("hash and verify PIN", async () => {
  const h = await hashPin("1234");
  assert.notEqual(h, await hashPin("1234"), "different salt each time");
  assert.equal(await verifyPin("1234", h), true);
  assert.equal(await verifyPin("1235", h), false);
  assert.equal(await verifyPin("1234", "garbage"), false);
});

test("PIN format", () => {
  for (const ok of ["1234", "123456"]) assert.ok(PIN_REGEX.test(ok));
  for (const bad of ["123", "1234567", "12a4", ""]) assert.ok(!PIN_REGEX.test(bad));
});

test("lock after MAX_ATTEMPTS failures", () => {
  const now = new Date(0);
  assert.deepEqual(afterFailedAttempt(0, now), { failedAttempts: 1, lockedUntil: null });
  assert.deepEqual(afterFailedAttempt(MAX_ATTEMPTS - 1, now), { failedAttempts: 0, lockedUntil: new Date(LOCK_MS) });
});
