/** Max stored photo (the browser reduces it before sending). */
export const PHOTO_MAX_BYTES = 200 * 1024;
/** Max download from a pasted link (the browser reduces it afterwards). */
export const REMOTE_MAX_BYTES = 5 * 1024 * 1024;

export type PhotoMime = "image/webp" | "image/png" | "image/jpeg";

/** URL of a product photo; `version` (updated_at ms) changes on replace, so it can be cached forever. */
export const photoUrl = (productId: string, version: number) => `/api/productos/${productId}/foto?v=${version}`;

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/** Image type by its magic bytes (never trust the client's `type`); null for anything else (GIF, AVIF, text…). */
export function imageMime(bytes: Uint8Array): PhotoMime | null {
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}
