// Browser-only storage of the day's route, to read it without signal (spec 024). Native IndexedDB + Cache Storage, no library.

const DB = "yaeli-ruta";
const STORE = "route";
const KEY = "today";
// Read by public/sw.js; bump both together.
const SHELL = "yr-shell-v1";

const done = <T>(r: IDBRequest<T>) =>
  new Promise<T>((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });

function openDb() {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  return done(r);
}

/** Runs one request on the store and closes the connection, so deleting the database is never blocked. */
async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await done(fn(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

export const saveRoute = <T>(snapshot: T) => withStore("readwrite", (s) => s.put(snapshot, KEY));

export const readRoute = <T>() => withStore("readonly", (s) => s.get(KEY) as IDBRequest<T | undefined>);

/** Saves these same-origin URLs (the page and its assets) for the SW to serve offline. Replaces the old copy only if all of them downloaded. */
export async function cacheShell(urls: string[]) {
  const got = await Promise.all(
    [...new Set(urls)].map(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      // A redirect means the session ended (→ /login): never cache that page as the route.
      if (!res.ok || res.redirected) throw new Error(`No se pudo guardar ${url}`);
      return [url, res] as const;
    }),
  );
  await caches.delete(SHELL);
  const cache = await caches.open(SHELL);
  await Promise.all(got.map(([url, res]) => cache.put(url, res)));
}

/** Deletes the route database and every shell cache (sign-out: the cached HTML carries the user's name and menus). */
export async function clearOfflineData() {
  await new Promise<void>((ok, fail) => {
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = () => ok();
    // Blocked: deletion runs as soon as the open connection closes.
    r.onblocked = () => ok();
    r.onerror = () => fail(r.error);
  });
  if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("yr-shell-")) await caches.delete(k);
}
