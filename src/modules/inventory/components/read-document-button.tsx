"use client";

import { useRef, useState } from "react";
import type { ReadDocument } from "../document-read";

const MAX_SIDE = 1600;
const MAX_PDF_BYTES = 4 * 1024 * 1024;

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

export function ReadDocumentButton({ onRead }: { onRead: (doc: ReadDocument) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  async function read(file: File) {
    setError("");
    let body: Blob;
    if (file.type === "application/pdf") {
      if (file.size > MAX_PDF_BYTES) return setError("El PDF pesa más de 4 MB");
      body = file;
    } else if (file.type.startsWith("image/")) {
      try {
        body = await toJpeg(file);
      } catch {
        return setError("No se pudo abrir la imagen; prueba con otra foto");
      }
    } else return setError("Solo foto o PDF");

    const form = new FormData();
    form.append("file", body, file.type === "application/pdf" ? "documento.pdf" : "foto.jpg");
    abort.current = new AbortController();
    setReading(true);
    try {
      const res = await fetch("/api/recepciones/leer", { method: "POST", body: form, signal: abort.current.signal });
      const json = await res.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
      if (!res.ok) return setError(json.error ?? "No se pudo leer");
      const doc = json as ReadDocument;
      if (!doc.lines.length) return setError("No se encontraron productos en el documento");
      onRead(doc);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Sin conexión; llena las líneas a mano");
    } finally {
      setReading(false);
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
      {reading ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm" aria-live="polite">
            Leyendo factura… (puede tardar hasta un minuto)
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
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
