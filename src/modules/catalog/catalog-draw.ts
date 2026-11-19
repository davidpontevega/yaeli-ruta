// Browser-only drawing of the customer catalog pages (1080×1920 JPEG). Imported only by the catalog builder (client).
import { BRAND } from "@/lib/brand";
import type { CatalogPage } from "./catalog-pages";

export type Design = "clasico" | "color" | "cuadricula";
export const PER_PAGE: Record<Design, number> = { clasico: 5, color: 5, cuadricula: 6 };

const W = 1080;
const H = 1920;
export const SERIF = 'Georgia, "Noto Serif", serif';
const SANS = 'system-ui, "Segoe UI", Roboto, sans-serif';
const INK = "#1F2933";
const FOOT = 120;
const PALETTE = ["#B7791F", "#2B6CB0", "#2F855A", "#C53030", "#6B46C1", "#C05621", "#2C7A7B", "#B83280"];

/** Same category → same color on every page and on the cover index ("Aceites (2)" keeps the color of "Aceites"). */
export const categoryColor = (title: string) =>
  PALETTE[[...title.replace(/\s\(\d+\)$/, "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

type Ctx = CanvasRenderingContext2D;
export type PageInfo = { design: Design; phone: string; page: number; total: number };

/** Up to `max` lines that fit `width`; the last one ends in "…" when the text does not fit. */
function wrap(ctx: Ctx, text: string, width: number, max: number) {
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

function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, shadow = false) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = "rgba(15,23,42,0.12)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

/** Photo fitted in a square, centered at (cx, cy), with a soft drop shadow that follows a cut-out's shape. */
function photo(ctx: Ctx, img: HTMLImageElement, cx: number, cy: number, size: number) {
  const s = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.22)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

function footer(ctx: Ctx, info: PageInfo, color: string) {
  const plain = info.design === "clasico";
  ctx.fillStyle = plain ? "#EFEBE5" : color;
  ctx.fillRect(0, H - FOOT, W, FOOT);
  const ink = plain ? "#52606D" : "#FFFFFF";
  const y = H - FOOT / 2;
  text(ctx, BRAND.company, 60, y, `bold 34px ${SANS}`, ink);
  text(ctx, `${info.page}/${info.total}`, W / 2, y, `30px ${SANS}`, ink, "center");
  if (info.phone) text(ctx, `Pedidos: ${info.phone}`, W - 60, y, `bold 34px ${SANS}`, ink, "right");
}

/** Title area; returns where the products start. */
function header(ctx: Ctx, title: string, info: PageInfo, color: string) {
  if (info.design === "clasico") {
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(0, 0, W, H);
    ctx.font = `bold 84px ${SERIF}`;
    text(ctx, wrap(ctx, title, W - 120, 1)[0], W / 2, 150, `bold 84px ${SERIF}`, INK, "center");
    box(ctx, W / 2 - 80, 222, 160, 10, 5, color);
    return 280;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `${color}14`;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 250);
  text(ctx, BRAND.company.toUpperCase(), W / 2, 62, `600 28px ${SANS}`, "rgba(255,255,255,0.75)", "center");
  ctx.font = `bold 84px ${SERIF}`;
  text(ctx, wrap(ctx, title, W - 120, 1)[0], W / 2, 150, `bold 84px ${SERIF}`, "#FFFFFF", "center");
  return 300;
}

/** One card per product, photo over the card edge on alternating sides (classic and color designs). */
function rows(ctx: Ctx, page: CatalogPage, images: Map<string, HTMLImageElement>, top: number, info: PageInfo, color: string) {
  const per = PER_PAGE[info.design];
  const slot = (H - FOOT - 40 - top) / per;
  const cardH = 210;
  const size = 280;
  const plain = info.design === "clasico";
  page.rows.forEach((row, i) => {
    const cy = top + slot * i + slot / 2;
    box(ctx, 60, cy - cardH / 2, W - 120, cardH, 36, plain ? "#ECEAE6" : "#FFFFFF", !plain);
    const right = row.side === "right";
    if (!plain) box(ctx, right ? 60 : W - 74, cy - cardH / 2 + 40, 14, cardH - 80, 7, color);
    photo(ctx, images.get(row.productId)!, right ? W - 40 - size / 2 : 40 + size / 2, cy, size);

    const x = right ? 110 : 40 + size + 40;
    const width = (right ? W - 40 - size - 30 : W - 110) - x;
    ctx.font = `bold 52px ${SERIF}`;
    const lines = [...wrap(ctx, row.title, width, 2).map((t) => ({ t, size: false })), ...(row.size ? [{ t: row.size, size: true }] : [])];
    const lh = 62;
    lines.forEach((l, k) =>
      text(
        ctx,
        l.t,
        x,
        cy - ((lines.length - 1) * lh) / 2 + k * lh,
        l.size ? `600 44px ${SANS}` : `bold 52px ${SERIF}`,
        l.size ? (plain ? "#52606D" : color) : INK,
      ),
    );
  });
}

/** 2 × 3 tiles: photo on top, name and a size pill below. */
function grid(ctx: Ctx, page: CatalogPage, images: Map<string, HTMLImageElement>, top: number, color: string) {
  const gap = 40;
  const w = (W - 120 - gap) / 2;
  const h = (H - FOOT - 40 - top - gap * 2) / 3;
  page.rows.forEach((row, i) => {
    const x = 60 + (i % 2) * (w + gap);
    const y = top + Math.floor(i / 2) * (h + gap);
    box(ctx, x, y, w, h, 36, "#FFFFFF", true);
    photo(ctx, images.get(row.productId)!, x + w / 2, y + 145, 250);
    ctx.font = `bold 40px ${SERIF}`;
    const lines = wrap(ctx, row.title, w - 50, 2);
    lines.forEach((t, k) => text(ctx, t, x + w / 2, y + 310 + k * 46, `bold 40px ${SERIF}`, INK, "center"));
    if (row.size) {
      ctx.font = `600 30px ${SANS}`;
      const pw = ctx.measureText(row.size).width + 40;
      const py = y + 310 + lines.length * 46 + 14;
      box(ctx, x + (w - pw) / 2, py - 24, pw, 48, 24, color);
      text(ctx, row.size, x + w / 2, py, `600 30px ${SANS}`, "#FFFFFF", "center");
    }
  });
}

function toJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo dibujar"))), "image/jpeg", 0.9));
}

function newCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return { canvas, ctx: canvas.getContext("2d")! };
}

export function drawPage(page: CatalogPage, images: Map<string, HTMLImageElement>, info: PageInfo) {
  const { canvas, ctx } = newCanvas();
  const color = categoryColor(page.title);
  const top = header(ctx, page.title, info, color);
  if (info.design === "cuadricula") grid(ctx, page, images, top, color);
  else rows(ctx, page, images, top, info, color);
  footer(ctx, info, color);
  return toJpeg(canvas);
}

/** Cover: company, month, the categories with the page where each starts, and the order phone. */
export function drawCover(index: { title: string; page: number; count: number }[], info: PageInfo) {
  const { canvas, ctx } = newCanvas();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0F766E");
  g.addColorStop(1, "#134E4A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.font = `bold 100px ${SERIF}`;
  wrap(ctx, BRAND.company, W - 160, 2).forEach((t, k) => text(ctx, t, W / 2, 260 + k * 110, `bold 100px ${SERIF}`, "#FFFFFF", "center"));
  text(ctx, "Catálogo de productos", W / 2, 520, `600 54px ${SANS}`, "#CCFBF1", "center");
  const month = new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", month: "long", year: "numeric" });
  text(ctx, month.charAt(0).toUpperCase() + month.slice(1), W / 2, 600, `40px ${SANS}`, "rgba(255,255,255,0.7)", "center");

  const top = 700;
  const bottom = info.phone ? H - 330 : H - 140;
  box(ctx, 60, top, W - 120, bottom - top, 40, "#FFFFFF");
  text(ctx, "Contenido", 120, top + 80, `bold 48px ${SERIF}`, INK);
  const rowH = Math.min(84, (bottom - top - 170) / Math.max(1, index.length));
  const font = Math.max(26, Math.min(40, rowH * 0.5));
  index.forEach((c, i) => {
    const y = top + 170 + i * rowH + rowH / 2;
    ctx.fillStyle = categoryColor(c.title);
    ctx.beginPath();
    ctx.arc(135, y, font * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `600 ${font}px ${SANS}`;
    text(ctx, wrap(ctx, c.title, W - 480, 1)[0], 170, y, `600 ${font}px ${SANS}`, INK);
    text(ctx, `${c.count} producto${c.count === 1 ? "" : "s"}`, W - 260, y, `${font * 0.8}px ${SANS}`, "#7B8794", "right");
    text(ctx, `pág. ${c.page}`, W - 120, y, `600 ${font * 0.8}px ${SANS}`, "#0F766E", "right");
  });

  if (info.phone) {
    text(ctx, "Pedidos por WhatsApp", W / 2, H - 230, `600 44px ${SANS}`, "#CCFBF1", "center");
    text(ctx, info.phone, W / 2, H - 150, `bold 76px ${SANS}`, "#FFFFFF", "center");
  }
  return toJpeg(canvas);
}
