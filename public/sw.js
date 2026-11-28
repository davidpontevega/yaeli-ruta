// Service worker (spec 024): opens "Mi ruta de hoy" without signal.
// It only reads the cache; the page writes it when it downloads the route (src/lib/offline-store.ts, same cache name).
const SHELL = "yr-shell-v1";
const PAGE = "/mi-ruta";
const WAIT_MS = 5000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("yr-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cached = (url) => caches.open(SHELL).then((c) => c.match(url, { ignoreSearch: true }));

const offline = () => new Response("Sin señal", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// Network first, at most WAIT_MS; then the saved route page (other screens redirect to it).
async function navigate(request) {
  const net = fetch(request);
  try {
    return await Promise.race([net, new Promise((_, fail) => setTimeout(() => fail(new Error("timeout")), WAIT_MS))]);
  } catch {
    const page = await cached(PAGE);
    if (page) return new URL(request.url).pathname === PAGE ? page : Response.redirect(PAGE, 302);
    return net.catch(offline);
  }
}

// Build assets and icons never change under the same URL: cache first.
const isAsset = (path) => path.startsWith("/_next/static/") || /^\/icon[^/]*\.(png|svg)$/.test(path);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") event.respondWith(navigate(request));
  else if (isAsset(url.pathname)) event.respondWith(cached(request).then((hit) => hit ?? fetch(request)));
});
