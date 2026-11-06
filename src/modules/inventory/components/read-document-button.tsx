"use client";

import { useRef, useState } from "react";
import type { ReadDocument } from "../document-read";

const MAX_SIDE = 1600;
const MAX_AI_BYTES = 4 * 1024 * 1024; // server limit (Vercel body 4.5 MB)
const MAX_LOCAL_BYTES = 15 * 1024 * 1024;
const NO_TABLE = "No se encontró la tabla del documento; prueba con la IA (con internet) o llena a mano";

/** Photo → JPEG of at most 1600 px per side. Re-encoding also drops the photo's metadata (location). */
async function toJpeg(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("canvas"))), "image/jpeg", 0.85));
}

/** AI reading on the server. Returns the document, an error message, or "offline" to fall back to the local reader. */
async function readWithAi(file: File, signal: AbortSignal): Promise<ReadDocument | string | "offline"> {
  const isPdf = file.type === "application/pdf";
  const body = isPdf ? file : await toJpeg(file);
  const form = new FormData();
  form.append("file", body, isPdf ? "documento.pdf" : "foto.jpg");
  try {
    const res = await fetch("/api/recepciones/leer", { method: "POST", body: form, signal });
    const json = await res.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
    if (res.status === 503) return "offline"; // reader unavailable: try on the device
    if (!res.ok) return json.error ?? "No se pudo leer";
    return json as ReadDocument;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return "offline";
  }
}

/**
 * One button, the best available reader:
 * PDF → its text layer on the device; else AI (key + internet); else Tesseract on the device. Photo → AI, else Tesseract.
 */
export function ReadDocumentButton({ onRead, aiEnabled }: { onRead: (doc: ReadDocument) => void; aiEnabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [status, setStatus] = useState(""); // non-empty = reading
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function read(file: File) {
    setError("");
    setDone("");
    const isPdf = file.type === "application/pdf";
    if (!isPdf && !file.type.startsWith("image/")) return setError("Solo foto o PDF");
    if (file.size > MAX_LOCAL_BYTES) return setError("El archivo pesa más de 15 MB");

    const signal = (abort.current = new AbortController()).signal;
    const finish = (doc: ReadDocument | null, source: string) => {
      if (signal.aborted) return; // cancelled while reading: drop the result
      if (!doc?.lines.length) return setError(NO_TABLE);
      onRead(doc);
      setDone(`${source}: ${doc.lines.length} línea${doc.lines.length === 1 ? "" : "s"}. Revisa cada una.`);
    };
    try {
      // Lazy: pdfjs and tesseract load only when a document is read.
      const local = await import("../read-local");
      if (isPdf) {
        setStatus("Leyendo el PDF en el celular…");
        const doc = await local.readPdfText(file).catch(() => null);
        if (doc) return finish(doc, "Leído en el celular");
      }
      if (aiEnabled && navigator.onLine && file.size <= MAX_AI_BYTES) {
        setStatus("Leyendo con IA… (puede tardar hasta un minuto)");
        const ai = await readWithAi(file, signal);
        if (typeof ai === "object") return finish(ai, "Leído con IA");
        if (ai !== "offline") return setError(ai);
      }
      finish(await local.readWithOcr(file, signal, setStatus), "Leído en el celular (sin internet, revisa con cuidado)");
    } catch (e) {
      if (signal.aborted) return; // cancelled by the user
      setError(e instanceof Error && e.message.startsWith("No se pudo") ? e.message : "No se pudo leer el documento; llena las líneas a mano");
    } finally {
      setStatus("");
      abort.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // same file can be chosen again
          if (f) read(f);
        }}
      />
      {status ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm" aria-live="polite">
            {status}
          </p>
          <button type="button" onClick={() => abort.current?.abort()} className="btn-secundario h-10 text-sm">
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="btn-secundario h-12">
          📷 Leer factura (foto o PDF)
        </button>
      )}
      {done && (
        <p className="text-sm text-emerald-700" aria-live="polite">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
