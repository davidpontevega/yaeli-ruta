import { test } from "node:test";
import assert from "node:assert/strict";
import { imageMime } from "./photo";

const b = (...x: (number | string)[]) => new Uint8Array(x.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

test("image type by magic bytes", () => {
  assert.equal(imageMime(b("RIFF", 1, 2, 3, 4, "WEBPVP8 ")), "image/webp");
  assert.equal(imageMime(b(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0)), "image/png");
  assert.equal(imageMime(b(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(imageMime(b("GIF89a")), null);
  assert.equal(imageMime(b(0, 0, 0, 0x1c, "ftypavif")), null);
  assert.equal(imageMime(b("RIFF", 1, 2, 3, 4, "WAVE")), null);
  assert.equal(imageMime(b("hola, no soy una foto")), null);
  assert.equal(imageMime(new Uint8Array()), null);
});
