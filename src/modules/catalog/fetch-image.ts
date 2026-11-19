import "server-only";
import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import type { IncomingMessage } from "node:http";
import type { LookupFunction } from "node:net";
import { isPublicIp, parseImageUrl } from "./image-url";
import { REMOTE_MAX_BYTES, imageMime, type PhotoMime } from "./photo";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

class DownloadError extends Error {}

// Resolves and refuses private addresses at connect time: the IP checked is the IP connected to (no DNS rebinding).
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (!addresses.length || addresses.some((a) => !isPublicIp(a.address)))
      return callback(new DownloadError("Ese enlace apunta a una dirección privada"), "");
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

function get(url: URL, signal: AbortSignal) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(
      url,
      { lookup: publicOnlyLookup, signal, agent: false, headers: { accept: "image/*", "user-agent": "Mozilla/5.0" } },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

async function readBody(res: IncomingMessage) {
  if (Number(res.headers["content-length"]) > REMOTE_MAX_BYTES) throw new DownloadError("La imagen pesa más de 5 MB");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > REMOTE_MAX_BYTES) {
      res.destroy();
      throw new DownloadError("La imagen pesa más de 5 MB");
    }
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Downloads an image from a public https link: ≤ 3 redirects (each revalidated), 8 s in total, ≤ 5 MB, webp/png/jpeg only. */
export async function downloadImage(start: URL): Promise<{ mime: PhotoMime; bytes: Uint8Array } | { error: string }> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = start;
  try {
    for (let hop = 0; ; hop++) {
      const res = await get(url, signal);
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (hop >= MAX_REDIRECTS) return { error: "El enlace redirige demasiadas veces" };
        const next = parseImageUrl(new URL(res.headers.location, url).href);
        if (!next.ok) return { error: next.error };
        url = next.url;
        continue;
      }
      if (status !== 200) {
        res.resume();
        return { error: "No se pudo descargar la imagen de ese enlace" };
      }
      if (!String(res.headers["content-type"] ?? "").startsWith("image/")) {
        res.resume();
        return { error: "El enlace no es una imagen; abre la imagen y copia su enlace" };
      }
      const bytes = await readBody(res);
      const mime = imageMime(bytes);
      return mime ? { mime, bytes } : { error: "Formato no soportado: usa PNG, JPG o WEBP" };
    }
  } catch (e) {
    if (e instanceof DownloadError) return { error: e.message };
    if (signal.aborted) return { error: "El enlace tardó demasiado en responder" };
    return { error: "No se pudo descargar la imagen de ese enlace" };
  }
}
