import { isIP } from "node:net";

const v4Num = (ip: string) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);
const inV4 = (n: number, base: string, bits: number) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(v4Num(base) / 2 ** (32 - bits));

// Not reachable on the public internet: unspecified, private, CGNAT, loopback, link-local (cloud metadata), test nets, multicast, reserved.
const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const isPublicV4 = (ip: string) => !V4_BLOCKED.some(([base, bits]) => inV4(v4Num(ip), base, bits));

/** IPv6 text → 8 numbers (an embedded dotted IPv4 becomes the last two). */
function v6Groups(ip: string): number[] {
  let s = ip.toLowerCase();
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = v4Num(dotted[1]);
    s = s.slice(0, -dotted[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const groups = tail === undefined ? h : [...h, ...Array<string>(8 - h.length - t.length).fill("0"), ...t];
  return groups.map((g) => parseInt(g, 16));
}

/** True only for an IP literal reachable on the public internet (IPv4 or IPv6, including IPv4-mapped). */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPublicV4(ip);
  if (kind !== 6 || ip.includes("%")) return false;
  const g = v6Groups(ip);
  const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
  // ::, ::1, ::a.b.c.d (deprecated) are never public; ::ffff:a.b.c.d is as public as its IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0 || g[5] === 0xffff)) return g[5] === 0xffff && isPublicV4(v4);
  if (g[0] === 0x64 && g[1] === 0xff9b) return isPublicV4(v4); // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return false; // link-local, old site-local
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0xdb8) return false; // documentation
  if (g[0] === 0x2002 || (g[0] === 0x2001 && g[1] === 0)) return false; // 6to4 and Teredo can tunnel to private IPv4
  return true;
}

/** A link the server may download: https, default port, no credentials, and not a private IP literal (hostnames are checked at connect time). */
export function parseImageUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "El enlace no es válido" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "El enlace debe empezar con https://" };
  if (url.username || url.password) return { ok: false, error: "El enlace no puede llevar usuario ni clave" };
  if (url.port && url.port !== "443") return { ok: false, error: "El enlace no puede usar otro puerto" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicIp(host)) return { ok: false, error: "Ese enlace apunta a una dirección privada" };
  return { ok: true, url };
}
