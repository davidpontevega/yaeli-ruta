"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { BRAND } from "@/lib/brand";
import { paginateCatalog, type CatalogPage } from "../catalog-pages";
import { photoUrl } from "../photo";
import type { CatalogSheet } from "../queries";

const W = 1080;
const H = 1920;
const PER_PAGE = 5;
const SERIF = 'Georgia, "Noto Serif", serif';
const BG = "#FAF8F5";
const CARD = "#ECEAE6";
const INK = "#1F2933";

type Rendered = { name: string; blob: Blob; url: string };

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "categoria";

/** Up to `max` lines that fit `width`; the last one ends in "…" when the text does not fit. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const lines: string[] = [];
  let line = "";
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    if (lines.length === max - 1) {
      line = `${line} ${words.slice(i).join(" ")}`;
      break;
    }
    lines.push(line);
    line = words[i];
  }
  if (ctx.measureText(line).width > width) {
    while (line.length > 1 && ctx.measureText(`${line}…`).width > width) line = line.slice(0, -1);
    line = `${line.trimEnd()}…`;
  }
  return [...lines, line];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** One 1080×1920 page: category title, up to 5 cards with the photo over the card edge (alternating sides), company at the foot. */
function drawPage(page: CatalogPage, images: Map<string, HTMLImageElement>) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 84px ${SERIF}`;
  ctx.fillText(wrap(ctx, page.title, W - 120, 1)[0], W / 2, 160);

  const top = 280;
  const slot = (1760 - top) / PER_PAGE;
  const cardH = 210;
  const photo = 270;
  page.rows.forEach((row, i) => {
    const cy = top + slot * i + slot / 2;
    ctx.fillStyle = CARD;
    roundRect(ctx, 60, cy - cardH / 2, W - 120, cardH, 36);

    const right = row.side === "right";
    const img = images.get(row.productId)!;
    const scale = Math.min(photo / img.naturalWidth, photo / img.naturalHeight);
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    const px = right ? W - 30 - photo : 30;
    ctx.drawImage(img, px + (photo - iw) / 2, cy - ih / 2, iw, ih);

    const textX = right ? 110 : 30 + photo + 40;
    const textW = (right ? W - 30 - photo - 40 : W - 110) - textX;
    ctx.textAlign = "left";
    ctx.font = `bold 52px ${SERIF}`;
    const titleLines = wrap(ctx, row.title, textW, 2);
    const lines = [...titleLines.map((t) => ({ t, size: false })), ...(row.size ? [{ t: row.size, size: true }] : [])];
    const lh = 62;
    lines.forEach((l, k) => {
      ctx.font = l.size ? `44px ${SERIF}` : `bold 52px ${SERIF}`;
      ctx.fillStyle = l.size ? "#52606D" : INK;
      ctx.fillText(l.t, textX, cy - ((lines.length - 1) * lh) / 2 + k * lh);
    });
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#7B8794";
  ctx.font = `40px ${SERIF}`;
  ctx.fillText(BRAND.company, W / 2, H - 70);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo dibujar"))), "image/jpeg", 0.9));
}

async function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Customer catalog: pick categories, see which products lack a photo, render the pages and share them. */
export function CatalogBuilder({ sheet }: { sheet: CatalogSheet }) {
  const [selected, setSelected] = useState(() => new Set(sheet.map((c) => c.categoryId)));
  const [pages, setPages] = useState<Rendered[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const urls = useRef<string[]>([]);

  const clear = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setPages([]);
  };
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const chosen = sheet.filter((c) => selected.has(c.categoryId));
  const missing = chosen.flatMap((c) => c.products.filter((p) => p.photoVersion === null).map((p) => ({ ...p, category: c.category })));
  const drawable = chosen.reduce((n, c) => n + c.products.filter((p) => p.photoVersion !== null).length, 0);

  const toggle = (id: string) => {
    clear();
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = () =>
    start(async () => {
      clear();
      setError("");
      try {
        await Promise.all([document.fonts.load(`bold 84px ${SERIF}`), document.fonts.load(`44px ${SERIF}`)]);
        const withPhoto = chosen.map((c) => ({
          title: c.category,
          products: c.products.flatMap((p) => (p.photoVersion === null ? [] : [{ id: p.id, name: p.name, photoVersion: p.photoVersion }])),
        }));
        const images = new Map<string, HTMLImageElement>();
        // A photo that fails to load is left out instead of breaking the whole catalog.
        await Promise.all(
          withPhoto.flatMap((g) =>
            g.products.map((p) =>
              loadImage(photoUrl(p.id, p.photoVersion)).then(
                (img) => images.set(p.id, img),
                () => undefined,
              ),
            ),
          ),
        );
        const groups = withPhoto.map((g) => ({ ...g, products: g.products.filter((p) => images.has(p.id)) }));
        const names = groups.flatMap((g) =>
          Array.from({ length: Math.ceil(g.products.length / PER_PAGE) }, (_, i) => `catalogo-${slug(g.title)}-${i + 1}.jpg`),
        );
        const out: Rendered[] = [];
        for (const [i, page] of paginateCatalog(groups, PER_PAGE).entries()) {
          const blob = await drawPage(page, images);
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          out.push({ name: names[i], blob, url });
        }
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
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h2 className="px-1 font-bold">Categorías</h2>
          <ul className="lista">
            {sheet.map((c) => {
              const withPhoto = c.products.filter((p) => p.photoVersion !== null).length;
              return (
                <li key={c.categoryId}>
                  <label className="fila flex min-h-12 cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={selected.has(c.categoryId)} onChange={() => toggle(c.categoryId)} className="h-5 w-5" />
                    <span className="flex-1 font-medium">{c.category}</span>
                    <span className="text-xs text-muted">
                      {withPhoto} con foto · {c.products.length - withPhoto} sin foto
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {missing.length > 0 && (
          <div className="tarjeta flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="titulo-tarjeta">Sin foto ({missing.length})</h2>
              <Link href="/productos/fotos" className="btn-suave flex h-9 items-center px-3 text-sm">
                Completar fotos
              </Link>
            </div>
            <p className="text-sm text-muted">No salen en el catálogo hasta que tengan foto.</p>
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((p) => (
                <li key={p.id}>
                  <Link href={`/productos/${p.id}`} className="chip bg-amber-50 text-amber-800 hover:bg-amber-100">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {drawable ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={generate} disabled={pending} className="btn-secundario h-12">
              {pending ? "Armando…" : "Ver catálogo"}
            </button>
            <button type="button" onClick={share} disabled={pending || !pages.length} className="btn-primario h-12">
              Compartir
            </button>
          </div>
        ) : (
          <>
            <EmptyState text="Nada que mostrar: elige categorías con productos que tengan foto." />
            <button type="button" disabled className="btn-primario h-12">
              Compartir
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {pages.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pages.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img key={p.url} src={p.url} alt={p.name} className="w-full rounded-xl border border-border" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
