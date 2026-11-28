// Browser-only storage of the day's route, to read it without signal (spec 024). Native IndexedDB + Cache Storage, no library.

const DB = "yaeli-ruta";
const STORE = "route";
const QUEUE = "queue"; // deliveries waiting to be uploaded (spec 025), key = op id
const KEY = "today";
// Read by public/sw.js; bump both together.
const SHELL = "yr-shell-v1";

const done = <T>(r: IDBRequest<T>) =>
  new Promise<T>((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });

function openDb() {
  const r = indexedDB.open(DB, 2);
  r.onupgradeneeded = () => {
    for (const name of [STORE, QUEUE]) if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name);
  };
  return done(r);
}

/** Runs one request on a store and closes the connection, so deleting the database is never blocked. */
async function withStore<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await done(fn(db.transaction(store, mode).objectStore(store)));
  } finally {
    db.close();
  }
}

export const saveRoute = <T>(snapshot: T) => withStore(STORE, "readwrite", (s) => s.put(snapshot, KEY));

export const readRoute = <T>() => withStore(STORE, "readonly", (s) => s.get(KEY) as IDBRequest<T | undefined>);

/** Deletes only the saved route (another user on this phone); the queue stays for its owner. */
export const clearRoute = () => withStore(STORE, "readwrite", (s) => s.delete(KEY));

/** Fired on `window` whenever the queue changes, so other parts of the page (the "Salir" button) can re-read it. */
export const QUEUE_EVENT = "yr-queue";
const queueChanged = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function putOp<T extends { id: string }>(op: T) {
  await withStore(QUEUE, "readwrite", (s) => s.put(op, op.id));
  queueChanged();
}

/** Every op on this phone, of any user, in the order they were saved (ids aren't ordered: sort by `at`). */
export const readOps = async <T extends { at: string }>() =>
  ((await withStore(QUEUE, "readonly", (s) => s.getAll())) as T[]).sort((a, b) => a.at.localeCompare(b.at));

export async function deleteOps(ids: string[]) {
  if (!ids.length) return;
  const db = await openDb();
  try {
    const tx = db.transaction(QUEUE, "readwrite");
    for (const id of ids) tx.objectStore(QUEUE).delete(id);
    await new Promise<void>((ok, fail) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => fail(tx.error);
    });
  } finally {
    db.close();
  }
  queueChanged();
}

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

/**
 * Sign-out: deletes the route database and every shell cache (the cached HTML carries the user's name and menus).
 * `keep` = op ids that must survive (another user's deliveries not uploaded yet): then only the route and the other ops go.
 */
export async function clearOfflineData(keep: string[] = []) {
  if (keep.length) {
    await clearRoute();
    const ids = (await readOps<{ id: string; at: string }>()).map((o) => o.id);
    await deleteOps(ids.filter((id) => !keep.includes(id)));
  } else
    await new Promise<void>((ok, fail) => {
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = () => ok();
      // Blocked: deletion runs as soon as the open connection closes.
      r.onblocked = () => ok();
      r.onerror = () => fail(r.error);
    });
  if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("yr-shell-")) await caches.delete(k);
}
