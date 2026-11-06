// Browser only. Whole-page OCR with Tesseract.js (Spanish) → positioned words.
// Adapted from Farmacia's src/lib/ocr/engine.ts: same image preparation and cancellation; one pass instead of per column.
import type { Worker } from "tesseract.js";
import type { Word } from "./table-read";

const WORK_WIDTH = 2400;
const DARK = 170;
const MIN_LINE = 90;

export class OcrCancelled extends Error {}
export class OcrEngineError extends Error {}

/** Tesseract doesn't reject pending work when the worker ends: stop waiting on abort. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new OcrCancelled());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new OcrCancelled());
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** Erases long dark runs (table borders): glued to text, Tesseract reads them as graphics. */
function removeLines(d: Uint8ClampedArray, w: number, h: number) {
  const erase = (start: number, step: number, len: number) => {
    let run = 0;
    for (let i = 0; i <= len; i++) {
      if (i < len && d[start + i * step] < DARK) run++;
      else {
        if (run >= MIN_LINE) for (let k = i - run; k < i; k++) d[start + k * step] = d[start + k * step + 1] = d[start + k * step + 2] = 255;
        run = 0;
      }
    }
  };
  for (let y = 0; y < h; y++) erase(y * w * 4, 4, w);
  for (let x = 0; x < w; x++) erase(x * 4, w * 4, h);
}

/** Fixed working width, grayscale, contrast stretched between percentiles 1 and 99, borders removed. */
function prepare(source: HTMLCanvasElement | ImageBitmap): HTMLCanvasElement {
  const scale = WORK_WIDTH / source.width;
  const c = document.createElement("canvas");
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round((d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const pixels = d.length / 4;
  const percentile = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= pixels * q) return v;
    return 255;
  };
  const lo = percentile(0.01);
  const span = Math.max(percentile(0.99) - lo, 1);
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = Math.min(255, Math.max(0, ((d[i] - lo) * 255) / span));
  removeLines(d, c.width, c.height);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** One reusable worker for a reading of several pages. The language data is downloaded once and cached by the browser. */
export async function createOcr(signal: AbortSignal) {
  const { createWorker, PSM } = await import("tesseract.js");
  const creating = createWorker("spa");
  let worker: Worker;
  try {
    worker = await untilAborted(creating, signal);
  } catch (e) {
    void creating.then(
      (w) => w.terminate(),
      () => undefined,
    ); // created anyway after cancel: end it when it arrives
    if (e instanceof OcrCancelled) throw e;
    throw new OcrEngineError("No se pudo cargar el lector sin internet. Primero lee una factura con internet.");
  }
  await untilAborted(worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }), signal);
  return {
    async words(source: HTMLCanvasElement | ImageBitmap): Promise<{ words: Word[]; text: string }> {
      const { data } = await untilAborted(worker.recognize(prepare(source), {}, { blocks: true, text: true }), signal);
      const words = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
        .map((w) => ({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1 }));
      return { words, text: data.text };
    },
    terminate: () => worker.terminate(),
  };
}
