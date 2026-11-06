// Browser only. Reads a supplier document on the device: PDF text layer first, OCR as fallback. Nothing leaves the device.
import type { ReadDocument } from "./document-read";
import { createOcr } from "./ocr-words";
import { pdfPages, pdfWords } from "./pdf-text";
import { linesToDocument, type Word } from "./table-read";

type Progress = (label: string) => void;

/** PDF text layer only (exact, fast, offline). null if it has no text or no table. */
export async function readPdfText(file: File): Promise<ReadDocument | null> {
  const { pages, text } = await pdfWords(file);
  if (!pages.some((p) => p.length)) return null;
  const doc = linesToDocument(pages, text);
  return doc?.lines.length ? doc : null;
}

/** Tesseract over each PDF page or over the photo. null if no table was found. */
export async function readWithOcr(file: File, signal: AbortSignal, onProgress: Progress): Promise<ReadDocument | null> {
  onProgress("Cargando el lector sin internet…");
  const ocr = await createOcr(signal);
  try {
    const pages: Word[][] = [];
    const texts: string[] = [];
    if (file.type === "application/pdf") {
      for await (const { canvas, n, total } of pdfPages(file)) {
        onProgress(`Leyendo página ${n} de ${total}…`);
        const r = await ocr.words(canvas);
        pages.push(r.words);
        texts.push(r.text);
      }
    } else {
      onProgress("Leyendo la foto…");
      const img = await createImageBitmap(file);
      const r = await ocr.words(img);
      img.close();
      pages.push(r.words);
      texts.push(r.text);
    }
    const doc = linesToDocument(pages, texts.join("\n"));
    return doc?.lines.length ? doc : null;
  } finally {
    await ocr.terminate();
  }
}
