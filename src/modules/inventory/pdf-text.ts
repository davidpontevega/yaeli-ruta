// Browser only. Reads a PDF with pdfjs: positioned words from its text layer, or a page rendered to a canvas (for OCR).
// Adapted from Farmacia's src/lib/ocr/pdf.ts. pdfjs is loaded only when used.
import { groupLines, splitItem, type Word } from "./table-read";

export const MAX_PDF_PAGES = 10;
const MIN_WIDTH = 2000;
const MAX_PIXELS = 24_000_000;

async function open(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  return { task, doc: await task.promise };
}

/** Words of each page (top-down coordinates) and the page text as lines. Empty pages = scanned PDF (no text layer). */
export async function pdfWords(file: File): Promise<{ pages: Word[][]; text: string; numPages: number }> {
  const { task, doc } = await open(file);
  try {
    const pages: Word[][] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES); n++) {
      const page = await doc.getPage(n);
      const height = page.getViewport({ scale: 1 }).height;
      const content = await page.getTextContent();
      const words: Word[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , , d, e, f] = item.transform as number[];
        const h = item.height || Math.abs(d) || 10;
        const y1 = height - f; // PDF y grows upwards; flip to image convention
        words.push(...splitItem(item.str, e, e + item.width, y1 - h, y1));
      }
      pages.push(words);
      page.cleanup();
    }
    const text = pages
      .map((w) =>
        groupLines(w)
          .map((l) => l.map((x) => x.text).join(" "))
          .join("\n"),
      )
      .join("\n");
    return { pages, text, numPages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

/** Renders each page (at least 2000 px wide) for OCR, one at a time. */
export async function* pdfPages(file: File): AsyncGenerator<{ canvas: HTMLCanvasElement; n: number; total: number }> {
  const { task, doc } = await open(file);
  try {
    const total = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(Math.max(1, MIN_WIDTH / base.width), Math.sqrt(MAX_PIXELS / (base.width * base.height))) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      yield { canvas, n, total };
    }
  } finally {
    await task.destroy();
  }
}
