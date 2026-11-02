import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, len: number) => Promise<Buffer>;

export const PIN_REGEX = /^\d{4,6}$/;
export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verificarPin(pin: string, guardado: string): Promise<boolean> {
  const [saltHex, hashHex] = guardado.split(":");
  if (!saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const hash = await scryptAsync(pin, Buffer.from(saltHex, "hex"), esperado.length);
  return timingSafeEqual(hash, esperado);
}

/** Estado tras un intento fallido: al llegar a MAX_INTENTOS se bloquea BLOQUEO_MS y el contador vuelve a 0. */
export function trasFallo(intentos: number, ahora: Date): { intentosFallidos: number; bloqueadoHasta: Date | null } {
  const n = intentos + 1;
  return n >= MAX_INTENTOS
    ? { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + BLOQUEO_MS) }
    : { intentosFallidos: n, bloqueadoHasta: null };
}
