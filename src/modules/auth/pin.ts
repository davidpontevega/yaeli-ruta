import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, len: number) => Promise<Buffer>;

export const PIN_REGEX = /^\d{4,6}$/;
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const hash = await scryptAsync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(hash, expected);
}

/** State after a failed attempt: reaching MAX_ATTEMPTS locks for LOCK_MS and resets the counter. */
export function afterFailedAttempt(attempts: number, now: Date): { failedAttempts: number; lockedUntil: Date | null } {
  const n = attempts + 1;
  return n >= MAX_ATTEMPTS ? { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MS) } : { failedAttempts: n, lockedUntil: null };
}
