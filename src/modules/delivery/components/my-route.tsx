"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSoles } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { formatKg } from "@/lib/weight";
import { cacheShell, clearOfflineData, readRoute, saveRoute } from "@/lib/offline-store";
import type { RouteSheet, RouteSnapshot } from "../route-snapshot";
import { SHEET_STATUS } from "./sheet-list";

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

  useEffect(() => {
    const on = () => {
      setOnline(true);
      void download();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    (async () => {
      setOnline(navigator.onLine);
      try {
        const saved = await readRoute<RouteSnapshot>();
        // Another user's data on this phone: gone before anything is shown.
        if (saved && saved.userId !== userId) await clearOfflineData();
        else if (saved) setRoute(saved);
      } catch (e) {
        console.error(e);
        setError("No se pudieron leer los datos guardados en este celular.");
      }
      setReady(true);
      await download();
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [userId, download]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-[22px] font-bold tracking-tight md:text-[26px]">Mi ruta de hoy</h1>
        {!online && <span className="chip bg-red-100 text-red-800">Sin señal</span>}
        <button type="button" onClick={download} disabled={!online || busy} className="btn-primario btn-entregar h-10 text-sm">
          {busy ? "Descargando…" : "Actualizar"}
        </button>
      </div>
      {route && <p className="text-sm text-muted">{downloadedLabel(route.downloadedAt)}</p>}
      {expired && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sesión vencida: entra con tu PIN para actualizar.{" "}
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
      ) : !route.sheets.length ? (
        <EmptyState text="No tienes hoja de ruta para hoy." />
      ) : (
        route.sheets.map((s) => <SheetCard key={s.id} sheet={s} />)
      )}
    </section>
  );
}

function SheetCard({ sheet: s }: { sheet: RouteSheet }) {
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
              {c.orders.map((o) => (
                <div key={o.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-semibold">Pedido {o.number}</span>
                    {o.status === "ENTREGADO" && <span className="chip bg-emerald-100 text-emerald-800">Entregado</span>}
                    <span className="cifra">{formatSoles(o.total)}</span>
                  </div>
                  <ul className="mt-1 text-muted">
                    {o.lines.map((l, j) => (
                      <li key={j}>
                        {l.quantity} {l.packaging} {l.product} · {formatSoles(l.price)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
