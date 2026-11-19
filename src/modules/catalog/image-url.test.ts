import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicIp, parseImageUrl } from "./image-url";

test("private, loopback, link-local, CGNAT and special IPs are not public", () => {
  for (const ip of [
    "127.0.0.1",
    "127.9.9.9",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "100.127.255.255",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:10.0.0.1",
    "::ffff:127.0.0.1",
    "::ffff:a00:1",
    "::ffff:7f00:1",
    "2002:a00:1::1",
    "2001:0:4136:e378::1",
    "ff02::1",
    "fe80::1%eth0",
    "no-es-ip",
  ])
    assert.equal(isPublicIp(ip), false, ip);
});

test("public IPs pass", () => {
  for (const ip of ["8.8.8.8", "172.32.0.1", "100.128.0.1", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])
    assert.equal(isPublicIp(ip), true, ip);
});

test("only https on the default port, without credentials or private IP literals", () => {
  assert.equal(parseImageUrl("http://ejemplo.com/a.png").ok, false);
  assert.equal(parseImageUrl("https://user:clave@ejemplo.com/a.png").ok, false);
  assert.equal(parseImageUrl("https://ejemplo.com:8443/a.png").ok, false);
  assert.equal(parseImageUrl("https://127.0.0.1/x.png").ok, false);
  assert.equal(parseImageUrl("https://169.254.169.254/").ok, false);
  assert.equal(parseImageUrl("https://[::1]/x.png").ok, false);
  assert.equal(parseImageUrl("https://[::ffff:10.0.0.1]/x.png").ok, false);
  assert.equal(parseImageUrl("no es un enlace").ok, false);
  assert.equal(parseImageUrl("https://ejemplo.com:443/a.png").ok, true);
  const r = parseImageUrl(" https://cdn.ejemplo.com/foto.webp?x=1 ");
  assert.ok(r.ok && r.url.hostname === "cdn.ejemplo.com");
});
