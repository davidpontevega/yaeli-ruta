"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSoles } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { formatKg } from "@/lib/weight";
import { cacheShell, clearRoute, deleteOps, putOp, readOps, readRoute, saveRoute } from "@/lib/offline-store";
import type { RouteCustomer, RouteOrder, RouteSheet, RouteSnapshot } from "../route-snapshot";
import { applyQueue, applyResults, limaDay, ownOps, staleSent, type OfflineOp, type SyncResult } from "../offline-queue";
import { SHEET_STATUS } from "./sheet-list";
import { OfflineDeliverForm } from "./offline-deliver-form";

const LIMA = { timeZone: "America/Lima" } as const;

/** "Descargado a las 07:42", or "Descargado el 27/11 a las 18:05" when it is not from today. */
function downloadedLabel(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-PE", { ...LIMA, hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => x.toLocaleDateString("es-PE", { ...LIMA, day: "2-digit", month: "2-digit" });
  return day(d) === day(new Date()) ? `Descargado a las ${time}` : `Descargado el ${day(d)} a las ${time}`;
}

/** The page and the assets it loaded, for the service worker to open it without signal. */
function shellUrls() {
  const same = (u: string) => {
    const url = new URL(u, location.href);
    return url.origin === location.origin ? url.pathname + url.search : null;
  };
  const fromDom = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map((s) => s.src);
  const styles = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="preload"][as="font"]')].map((l) => l.href);
  // Chunks loaded after hydration aren't in the DOM.
  const loaded = performance.getEntriesByType("resource").map((e) => e.name);
  const assets = [...fromDom, ...styles, ...loaded].map(same).filter((u): u is string => !!u && u.startsWith("/_next/static/"));
  return ["/mi-ruta", ...assets];
}

/** Today's sheets for the phone: downloads with signal, keeps them in IndexedDB and reads from there without signal. */
export function MyRoute({ userId }: { userId: string }) {
  const [route, setRoute] = useState<RouteSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every op on this phone (any user); only this user's are shown or uploaded.
  const [ops, setOps] = useState<OfflineOp[]>([]);
  const [uploading, setUploading] = useState(false);
  const sending = useRef(false); // one upload at a time

  const download = useCallback(async () => {
    if (!navigator.onLine) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mi-ruta", { cache: "no-store" });
      if (res.status === 401) return setExpired(true);
      if (!res.ok) {
        const fail: { error?: string } | null = await res.json().catch(() => null);
        return setError(fail?.error ?? `No se pudo descargar la hoja (error ${res.status})`);
      }
      const body: RouteSnapshot = await res.json();
      setExpired(false);
      await saveRoute(body);
      setRoute(body);
      await cacheShell(shellUrls()).catch((e: unknown) => {
        console.error(e);
        setError("La hoja se guardó, pero la pantalla no: vuelve a tocar Actualizar antes de salir.");
      });
    } catch (e) {
      console.error(e);
      setError("No se pudo descargar: revisa tu señal. Se muestran los datos guardados.");
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshOps = useCallback(async () => setOps(await readOps<OfflineOp>()), []);

  /** Uploads this user's pending deliveries (50 per request), then downloads the sheet again. */
  const sync = useCallback(async () => {
    if (sending.current || !navigator.onLine) return;
    sending.current = true;
    setUploading(true);
    try {
      const pending = ownOps(await readOps<OfflineOp>(), userId).filter((o) => o.state === "pending");
      for (let i = 0; i < pending.length; i += 50) {
        const chunk = pending.slice(i, i + 50);
        const res = await fetch("/api/mi-ruta/sync", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ops: chunk.map(({ id, sheetId, orderId, lines, paid, method }) => ({ id, sheetId, orderId, lines, paid, method })),
          }),
        });
        if (res.status === 401) return setExpired(true);
        if (!res.ok) {
          const fail: { error?: string } | null = await res.json().catch(() => null);
          return setError(`${fail?.error ?? `No se pudieron subir las entregas (error ${res.status})`}. Siguen guardadas en el celular.`);
        }
        const { results }: { results: SyncResult[] } = await res.json();
        for (const op of applyResults(chunk, results)) if (op.state !== "pending") await putOp(op);
      }
    } catch (e) {
      console.error(e);
      setError("No se pudieron subir las entregas: revisa tu señal. Siguen guardadas en el celular.");
    } finally {
      sending.current = false;
      setUploading(false);
      await refreshOps().catch(console.error);
    }
    await download();
  }, [userId, download, refreshOps]);

  const save = async (sheetId: string, c: RouteCustomer, o: RouteOrder, op: Pick<OfflineOp, "lines" | "paid" | "method">) => {
    await putOp<OfflineOp>({
      ...op,
      id: crypto.randomUUID(),
      userId,
      sheetId,
      orderId: o.id,
      at: new Date().toISOString(),
      state: "pending",
      customerName: c.name,
      orderNumber: o.number,
    });
    await refreshOps();
    void sync();
  };

  const dismiss = async (id: string) => {
    await deleteOps([id]);
    await refreshOps();
  };

  useEffect(() => {
    const on = () => {
      setOnline(true);
      void sync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    (async () => {
      setOnline(navigator.onLine);
      try {
        const saved = await readRoute<RouteSnapshot>();
        // Another user's sheet on this phone: gone before anything is shown. Their queue stays (hidden) until they come back.
        if (saved && saved.userId !== userId) await clearRoute();
        else if (saved) setRoute(saved);
        await deleteOps(staleSent(ownOps(await readOps<OfflineOp>(), userId), limaDay(new Date())).map((o) => o.id));
        await refreshOps();
      } catch (e) {
        console.error(e);
        setError("No se pudieron leer los datos guardados en este celular.");
      }
      setReady(true);
      await sync();
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [userId, sync, refreshOps]);

  const mine = ownOps(ops, userId);
  const toUpload = mine.filter((o) => o.state === "pending").length;
  const rejected = mine.filter((o) => o.state === "rejected");
  const othersPending = ops.some((o) => o.userId !== userId && o.state === "pending");
  // Latest op of each order (ops are sorted by time; a rejected one can be followed by a new try).
  const opOf = new Map(mine.filter((o) => o.state !== "rejected").map((o) => [o.orderId, o]));
  const sheets = route ? applyQueue(route.sheets, mine) : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-[22px] font-bold tracking-tight md:text-[26px]">Mi ruta de hoy</h1>
        {!online && <span className="chip bg-red-100 text-red-800">Sin señal</span>}
        {toUpload > 0 && <span className="chip bg-amber-100 text-amber-800">{toUpload} por subir</span>}
        <button type="button" onClick={download} disabled={!online || busy} className="btn-primario btn-entregar h-10 text-sm">
          {busy ? "Descargando…" : "Actualizar"}
        </button>
      </div>
      {route && <p className="text-sm text-muted">{downloadedLabel(route.downloadedAt)}</p>}
      {toUpload > 0 && (
        <button type="button" onClick={sync} disabled={!online || uploading} className="btn-primario btn-entregar h-12 w-full">
          {uploading ? "Subiendo…" : `Subir ahora (${toUpload})`}
        </button>
      )}
      {rejected.length > 0 && (
        <div className="tarjeta flex flex-col gap-2 border-red-200 bg-red-50">
          <p className="font-bold text-red-800">No se pudieron subir</p>
          {rejected.map((o) => (
            <div key={o.id} className="flex items-start gap-2 text-sm text-red-800">
              <p className="min-w-0 flex-1">
                <span className="font-semibold">
                  {o.customerName} · Pedido {o.orderNumber}
                </span>
                <br />
                {o.reason}
              </p>
              <button type="button" onClick={() => dismiss(o.id)} className="btn-secundario h-10 text-sm">
                Entendido
              </button>
            </div>
          ))}
        </div>
      )}
      {othersPending && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Hay entregas de otro usuario sin subir; que entre él con su PIN para subirlas.
        </p>
      )}
      {expired && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {toUpload > 0
            ? `Sesión vencida: entra con tu PIN para subir ${toUpload} entrega${toUpload === 1 ? "" : "s"}.`
            : "Sesión vencida: entra con tu PIN para actualizar."}{" "}
          <Link href="/login" className="font-semibold underline">
            Entrar
          </Link>
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!route ? (
        ready && !online ? (
          <EmptyState text="Descarga tu hoja con señal antes de salir." />
        ) : (
          busy && <p className="text-sm text-muted">Descargando tu hoja…</p>
        )
      ) : !sheets.length ? (
        <EmptyState text="No tienes hoja de ruta para hoy." />
      ) : (
        sheets.map((s) => <SheetCard key={s.id} sheet={s} opOf={opOf} onSave={(c, o, op) => save(s.id, c, o, op)} />)
      )}
    </section>
  );
}

function SheetCard({
  sheet: s,
  opOf,
  onSave,
}: {
  sheet: RouteSheet;
  opOf: Map<string, OfflineOp>;
  onSave: (c: RouteCustomer, o: RouteOrder, op: Pick<OfflineOp, "lines" | "paid" | "method">) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null); // order being delivered
  const load = s.status === "EN_RUTA" ? "Carga del vehículo" : "Para cargar";
  return (
    <article className="flex flex-col gap-3">
      <div>
        <p className="font-bold">
          {s.routeName} · {s.vehicleName}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="chip bg-slate-100 text-slate-600">#{s.number}</span>
          <span className={`chip ${SHEET_STATUS[s.status].className}`}>{SHEET_STATUS[s.status].label}</span>
          <span className="chip bg-slate-100 text-slate-600">{formatDate(s.date)}</span>
          <span className="chip bg-slate-100 text-slate-600">Reparte: {s.driverName ?? "el dueño"}</span>
        </div>
      </div>
      {!s.customers.length ? (
        <EmptyState text="Esta hoja todavía no tiene pedidos." />
      ) : (
        <ol className="lista">
          {s.customers.map((c, i) => (
            <li key={c.id} className="fila flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <span className="chip bg-teal-100 text-teal-800">{i + 1}</span>
                <p className="min-w-0 flex-1 font-semibold leading-tight">{c.name}</p>
                {c.debt > 0 && <span className="chip bg-red-100 text-red-800">Debe {formatSoles(c.debt)}</span>}
              </div>
              {(c.address || c.reference) && <p className="text-sm text-muted">{[c.address, c.reference].filter(Boolean).join(" · ")}</p>}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="text-sm font-semibold text-primary">
                  {c.phone}
                </a>
              )}
              {c.orders.map((o) => {
                const op = opOf.get(o.id);
                return (
                  <div key={o.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-semibold">Pedido {o.number}</span>
                      {op?.state === "pending" ? (
                        <span className="chip bg-amber-100 text-amber-800">Entregado (por subir)</span>
                      ) : op?.state === "sent" ? (
                        <span className="chip bg-emerald-100 text-emerald-800">Subido</span>
                      ) : (
                        o.status === "ENTREGADO" && <span className="chip bg-emerald-100 text-emerald-800">Entregado</span>
                      )}
                      <span className="cifra">{formatSoles(o.total)}</span>
                    </div>
                    {open === o.id && o.status === "PENDIENTE" ? (
                      <OfflineDeliverForm
                        order={o}
                        debt={c.debt}
                        onSave={async (x) => {
                          await onSave(c, o, x);
                          setOpen(null);
                        }}
                        onClose={() => setOpen(null)}
                      />
                    ) : (
                      <>
                        <ul className="mt-1 text-muted">
                          {o.lines.map((l) => (
                            <li key={l.packagingId}>
                              {l.quantity} {l.packaging} {l.product} · {formatSoles(l.price)}
                            </li>
                          ))}
                        </ul>
                        {s.status === "EN_RUTA" && o.status === "PENDIENTE" && (
                          <button type="button" onClick={() => setOpen(o.id)} className="btn-primario btn-entregar mt-2 h-12 w-full text-base">
                            Entregar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </li>
          ))}
        </ol>
      )}
      <details className="tarjeta">
        <summary className="cursor-pointer text-sm font-semibold text-primary">
          {load} · {formatKg(s.load.weightGrams)}
          {s.load.noWeight > 0 && ` (${s.load.noWeight} sin peso)`}
        </summary>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {s.load.items.map((x) => (
            <li key={`${x.product}|${x.expiresOn}`}>
              {x.qty} {x.product}
              {x.expiresOn && <span className="text-muted"> · vence {formatDate(x.expiresOn)}</span>}
            </li>
          ))}
          {s.load.short.map((x) => (
            <li key={`short|${x.product}`} className="text-red-700">
              Falta {x.missing} {x.product}
            </li>
          ))}
          {!s.load.items.length && !s.load.short.length && <li className="text-muted">Nada por cargar.</li>}
        </ul>
      </details>
    </article>
  );
}
