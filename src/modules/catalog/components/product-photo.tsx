"use client";

import { useState, useTransition } from "react";
import { IconTile } from "@/components/ui/avatar";
import { deleteProductPhoto, fetchImageFromUrl, saveProductPhoto } from "../actions";
import { PHOTO_MAX_BYTES, photoUrl } from "../photo";

const PASTE_HINT = "Copia una imagen o pégala aquí (Ctrl+V / mantener pulsado)";
const IMAGE_ICON = "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01";

type Source = "file" | "paste" | "url";

/** Draws the image at most `max` px on its longer side and encodes it (webp if the browser can, else what it gives). */
async function encode(bitmap: ImageBitmap, max: number) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo leer la imagen");
  return blob;
}

/** Every photo (file, clipboard or link) goes through here: 600 px, then 480 and 360 if it is still over 200 KB. */
async function reduce(input: Blob) {
  const bitmap = await createImageBitmap(input).catch(() => {
    throw new Error("No se pudo leer la imagen; prueba con otra");
  });
  try {
    for (const max of [600, 480, 360]) {
      const blob = await encode(bitmap, max);
      if (blob.size <= PHOTO_MAX_BYTES) return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("La foto es muy pesada");
}

/** Photo of a product: search it on Google, paste it, bring it from a link or upload a file; replace or remove it. */
export function ProductPhoto({
  productId,
  name,
  photoVersion,
  onSaved,
}: {
  productId: string;
  name: string;
  photoVersion: number | null;
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [link, setLink] = useState("");

  const save = (get: () => Promise<Blob | null>, source: Source) =>
    start(async () => {
      setMsg({});
      try {
        const input = await get();
        if (!input) return setMsg({ error: PASTE_HINT });
        const blob = await reduce(input);
        const form = new FormData();
        form.set("productId", productId);
        form.set("source", source);
        form.set("file", blob, `foto.${blob.type.split("/")[1] ?? "img"}`);
        const res = await saveProductPhoto(undefined, form);
        setMsg(res ?? {});
        if (res?.ok) {
          setLink("");
          onSaved?.();
        }
      } catch (e) {
        setMsg({ error: e instanceof Error ? e.message : "No se pudo guardar la foto" });
      }
    });

  const pasteFromClipboard = () =>
    save(async () => {
      if (!navigator.clipboard?.read) return null;
      try {
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find((t) => t.startsWith("image/"));
          if (type) return await item.getType(type);
        }
      } catch {
        /* no permission: the paste zone below still works */
      }
      return null;
    }, "paste");

  const fromLink = () =>
    save(async () => {
      const res = await fetchImageFromUrl({ url: link });
      if (!res.ok) throw new Error(res.error);
      return new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], { type: res.mime });
    }, "url");

  const search = `https://www.google.com/search?tbm=isch&tbs=ic:trans&q=${encodeURIComponent(name)}`;

  return (
    <div className="tarjeta flex flex-col gap-3">
      <h2 className="titulo-tarjeta">
        {photoVersion ? (
          // eslint-disable-next-line @next/next/no-img-element -- private API image; next/image would not send the session
          <img
            src={photoUrl(productId, photoVersion)}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-xl border border-border bg-white object-contain"
          />
        ) : (
          <IconTile d={IMAGE_ICON} />
        )}
        Foto para el catálogo
      </h2>

      <div
        tabIndex={0}
        onPaste={(e) => {
          const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
          if (!file) return setMsg({ error: PASTE_HINT });
          e.preventDefault();
          save(async () => file, "paste");
        }}
        className="flex min-h-40 items-center justify-center rounded-xl border-2 border-dashed border-border bg-slate-50 p-2 text-center text-sm text-muted outline-none focus:border-primary"
        aria-label="Zona para pegar la foto"
      >
        {photoVersion ? (
          // eslint-disable-next-line @next/next/no-img-element -- private API image; next/image would not send the session
          <img src={photoUrl(productId, photoVersion)} alt={name} className="max-h-48 object-contain" />
        ) : (
          <span>Sin foto. Búscala, cópiala y pégala aquí (Ctrl+V / mantener pulsado).</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href={search} target="_blank" rel="noopener" className="btn-suave flex h-10 items-center justify-center text-sm">
          Buscar foto
        </a>
        <button type="button" onClick={pasteFromClipboard} disabled={pending} className="btn-suave h-10 text-sm">
          Pegar foto
        </button>
        <label
          className={`btn-secundario flex h-10 cursor-pointer items-center justify-center text-sm ${pending ? "pointer-events-none opacity-60" : ""}`}
        >
          Subir archivo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) save(async () => file, "file");
            }}
          />
        </label>
        {photoVersion ? (
          <form action={deleteProductPhoto} onSubmit={() => setMsg({})}>
            <input type="hidden" name="productId" value={productId} />
            <button disabled={pending} className="h-10 w-full rounded-xl text-sm font-medium text-red-700 hover:bg-red-50">
              Quitar foto
            </button>
          </form>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Enlace de la imagen (https://…)"
          aria-label="Enlace de la imagen"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
        />
        <button type="button" onClick={fromLink} disabled={pending || !link.trim()} className="btn-primario h-10 px-3 text-sm">
          Pegar enlace
        </button>
      </div>

      <p role="status" className={`min-h-5 text-sm ${msg.error ? "text-red-600" : "text-emerald-700"}`}>
        {pending ? "Guardando foto…" : (msg.error ?? msg.ok)}
      </p>
    </div>
  );
}
