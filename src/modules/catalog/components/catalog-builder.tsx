"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { BRAND } from "@/lib/brand";
import { paginateCatalog } from "../catalog-pages";
import { PER_PAGE, SERIF, categoryColor, drawCover, drawPage, type Design } from "../catalog-draw";
import { photoUrl } from "../photo";
import type { CatalogSheet } from "../queries";

type Rendered = { name: string; blob: Blob; url: string };

const DESIGNS: { id: Design; label: string; hint: string }[] = [
  { id: "clasico", label: "Clásico", hint: "Como el de Canva · 5 por imagen" },
  { id: "color", label: "Color", hint: "Franja de color por categoría · 5 por imagen" },
  { id: "cuadricula", label: "Cuadrícula", hint: "2 columnas · 6 por imagen, menos imágenes" },
];
const PREFS = "yr_catalogo";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "categoria";

async function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Small drawing of each design, so the choice is visual. */
function DesignThumb({ id, color }: { id: Design; color: string }) {
  const card = id === "clasico" ? "bg-[#ECEAE6]" : "bg-white shadow-sm";
  return (
    <span
      className={`flex h-24 w-14 shrink-0 flex-col gap-1 overflow-hidden rounded-md border border-border p-1 ${id === "clasico" ? "bg-[#FAF8F5]" : "bg-white"}`}
    >
      {id === "clasico" ? (
        <span className="mx-auto mt-0.5 h-1.5 w-7 rounded" style={{ background: "#1F2933" }} />
      ) : (
        <span className="-mx-1 -mt-1 h-3.5" style={{ background: color }} />
      )}
      {id === "cuadricula" ? (
        <span className="grid flex-1 grid-cols-2 gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`rounded-sm ${card}`} />
          ))}
        </span>
      ) : (
        Array.from({ length: 4 }, (_, i) => <span key={i} className={`h-3 rounded-sm ${card}`} />)
      )}
    </span>
  );
}

/** Customer catalog: pick categories and a design, see what lacks a photo, render the images and share them. */
export function CatalogBuilder({ sheet }: { sheet: CatalogSheet }) {
  const [selected, setSelected] = useState(() => new Set(sheet.map((c) => c.categoryId)));
  const [design, setDesign] = useState<Design>("clasico");
  const [cover, setCover] = useState(true);
  const [phone, setPhone] = useState("");
  const [pages, setPages] = useState<Rendered[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const urls = useRef<string[]>([]);

  // Design, cover and phone are remembered on this device.
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
      /* eslint-disable react-hooks/set-state-in-effect -- localStorage only exists in the browser */
      if (DESIGNS.some((d) => d.id === p.design)) setDesign(p.design);
      if (typeof p.cover === "boolean") setCover(p.cover);
      if (typeof p.phone === "string") setPhone(p.phone);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      /* private mode: defaults */
    }
  }, []);
  const remember = (patch: object) => {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ design, cover, phone, ...patch }));
    } catch {
      /* private mode */
    }
  };

  const clear = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setPages([]);
  };
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const withPhoto = (c: CatalogSheet[number]) => c.products.filter((p) => p.photoVersion !== null);
  const chosen = sheet.filter((c) => selected.has(c.categoryId));
  const missing = chosen.flatMap((c) => c.products.filter((p) => p.photoVersion === null).map((p) => ({ ...p, category: c.category })));
  const total = sheet.reduce((n, c) => n + c.products.length, 0);
  const photos = sheet.reduce((n, c) => n + withPhoto(c).length, 0);
  const drawable = chosen.reduce((n, c) => n + withPhoto(c).length, 0);
  const images = chosen.reduce((n, c) => n + Math.ceil(withPhoto(c).length / PER_PAGE[design]), 0) + (cover && drawable ? 1 : 0);

  const toggle = (id: string) => {
    clear();
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setAll = (on: boolean) => {
    clear();
    setSelected(new Set(on ? sheet.map((c) => c.categoryId) : []));
  };

  const generate = () =>
    start(async () => {
      clear();
      setError("");
      try {
        await Promise.all([document.fonts.load(`bold 84px ${SERIF}`), document.fonts.load(`44px ${SERIF}`)]);
        const groups0 = chosen.map((c) => ({
          title: c.category,
          products: withPhoto(c).map((p) => ({ id: p.id, name: p.name, photoVersion: p.photoVersion! })),
        }));
        const loaded = new Map<string, HTMLImageElement>();
        // A photo that fails to load is left out instead of breaking the whole catalog.
        await Promise.all(
          groups0.flatMap((g) =>
            g.products.map((p) =>
              loadImage(photoUrl(p.id, p.photoVersion)).then(
                (img) => loaded.set(p.id, img),
                () => undefined,
              ),
            ),
          ),
        );
        const groups = groups0.map((g) => ({ ...g, products: g.products.filter((p) => loaded.has(p.id)) })).filter((g) => g.products.length);
        const per = PER_PAGE[design];
        const list = paginateCatalog(groups, per);
        const first = cover ? 2 : 1;
        const totalPages = list.length + (cover ? 1 : 0);
        const out: Rendered[] = [];
        const push = (name: string, blob: Blob) => {
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          out.push({ name, blob, url });
        };
        if (cover && list.length) {
          let at = first;
          const index = groups.map((g) => {
            const row = { title: g.title, page: at, count: g.products.length };
            at += Math.ceil(g.products.length / per);
            return row;
          });
          push("catalogo-00-portada.jpg", await drawCover(index, { design, phone, page: 1, total: totalPages }));
        }
        for (const [i, page] of list.entries())
          push(
            `catalogo-${String(i + first).padStart(2, "0")}-${slug(page.title)}.jpg`,
            await drawPage(page, loaded, { design, phone, page: i + first, total: totalPages }),
          );
        if (!out.length) setError("No se pudo cargar ninguna foto");
        setPages(out);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo armar el catálogo");
      }
    });

  const share = async () => {
    const files = pages.map((p) => new File([p.blob], p.name, { type: "image/jpeg" }));
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, title: `Catálogo ${BRAND.company}` });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("No se pudo compartir; prueba de nuevo");
      }
      return;
    }
    for (const p of pages) {
      const a = document.createElement("a");
      a.href = p.url;
      a.download = p.name;
      a.click();
      // Browsers drop back-to-back downloads; a short pause lets each one start.
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  if (!sheet.length) return <EmptyState text="No hay productos activos marcados para el catálogo." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Productos en catálogo" value={total} />
        <Stat label="Con foto" value={photos} tone="text-emerald-700" hint={`${Math.round((photos / total) * 100)}% listo`} />
        <Stat
          href="/productos/fotos"
          label="Sin foto"
          value={total - photos}
          tone={total - photos ? "text-amber-700" : ""}
          hint={total - photos ? "Completar fotos →" : undefined}
        />
        <Stat label="Imágenes a enviar" value={images} tone="text-primary" hint={cover && drawable ? "con portada" : undefined} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-4">
          <section className="lista">
            <header className="flex items-center gap-2 bg-slate-50/70 px-4 py-3">
              <h2 className="flex-1 font-bold">1. Categorías</h2>
              <button type="button" onClick={() => setAll(true)} className="text-sm text-primary">
                Todas
              </button>
              <span className="text-muted">·</span>
              <button type="button" onClick={() => setAll(false)} className="text-sm text-primary">
                Ninguna
              </button>
            </header>
            <ul className="divide-y divide-slate-100">
              {sheet.map((c) => {
                const ok = withPhoto(c);
                const pct = Math.round((ok.length / c.products.length) * 100);
                const color = categoryColor(c.category);
                return (
                  <li key={c.categoryId}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected.has(c.categoryId)}
                        onChange={() => toggle(c.categoryId)}
                        className="h-5 w-5 shrink-0"
                      />
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.category}</span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </span>
                          <span className="text-xs text-muted">
                            {ok.length} de {c.products.length} con foto
                          </span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 -space-x-2 sm:flex">
                        {ok.slice(0, 4).map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element -- small cached product photo
                          <img
                            key={p.id}
                            src={photoUrl(p.id, p.photoVersion!)}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 rounded-lg border-2 border-white bg-slate-50 object-contain"
                          />
                        ))}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          {missing.length > 0 && (
            <div className="tarjeta flex flex-col gap-2 border-amber-200 bg-amber-50/40">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">Sin foto ({missing.length})</h2>
                <Link href="/productos/fotos" className="btn-primario flex h-9 items-center px-3 text-sm">
                  Completar fotos
                </Link>
              </div>
              <p className="text-sm text-muted">No salen en el catálogo hasta que tengan foto.</p>
              <ul className="flex flex-wrap gap-1.5">
                {missing.map((p) => (
                  <li key={p.id}>
                    <Link href={`/productos/${p.id}`} className="chip bg-amber-100 text-amber-800 hover:bg-amber-200">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section className="tarjeta flex flex-col gap-3">
            <h2 className="font-bold">2. Diseño</h2>
            <div className="grid grid-cols-3 gap-2">
              {DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    clear();
                    setDesign(d.id);
                    remember({ design: d.id });
                  }}
                  aria-pressed={design === d.id}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-center transition ${design === d.id ? "border-primary bg-teal-50" : "border-border hover:border-slate-300"}`}
                >
                  <DesignThumb id={d.id} color={categoryColor(chosen[0]?.category ?? "Aceites")} />
                  <span className="text-sm font-semibold">{d.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{DESIGNS.find((d) => d.id === design)!.hint}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cover}
                onChange={(e) => {
                  clear();
                  setCover(e.target.checked);
                  remember({ cover: e.target.checked });
                }}
                className="h-5 w-5"
              />
              Portada con índice de categorías
            </label>
            <label className="campo">
              WhatsApp para pedidos
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                maxLength={20}
                onChange={(e) => {
                  clear();
                  setPhone(e.target.value);
                  remember({ phone: e.target.value });
                }}
                placeholder="987 654 321 (opcional)"
              />
            </label>
          </section>

          <section className="tarjeta flex flex-col gap-3">
            <h2 className="font-bold">3. Ver y enviar</h2>
            {drawable ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={generate} disabled={pending} className="btn-secundario h-12">
                  {pending ? "Armando…" : pages.length ? "Volver a armar" : "Ver catálogo"}
                </button>
                <button type="button" onClick={share} disabled={pending || !pages.length} className="btn-primario btn-catalogo h-12">
                  Enviar {pages.length ? `(${pages.length})` : ""}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted">Elige categorías con productos que tengan foto.</p>
            )}
            {!pages.length && drawable > 0 && <p className="text-xs text-muted">Primero toca «Ver catálogo» para revisar las imágenes.</p>}
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            {pages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pages.map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="noreferrer" title="Ver en grande">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                    <img src={p.url} alt={p.name} className="w-full rounded-lg border border-border transition hover:opacity-90" />
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
