"use client";

import type { FormEvent } from "react";
import Swal from "sweetalert2";

type Tone = "cargar" | "cerrar" | "peligro" | "normal";
const BUTTON: Record<Tone, string> = {
  cargar: "btn-primario btn-cargar",
  cerrar: "btn-primario btn-cerrar",
  peligro: "btn-primario bg-red-600",
  normal: "btn-primario",
};

/**
 * Form `onSubmit` that asks first in a friendly popup (instead of the browser's confirm()).
 * On "yes" it re-submits the same form, so the form's action runs as usual.
 */
export function askFirst(o: { title: string; text?: string; note?: string; yes: string; tone?: Tone }) {
  return (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    if (form.dataset.ok) return void delete form.dataset.ok;
    e.preventDefault();
    if (!form.reportValidity()) return;
    void Swal.fire({
      title: o.title,
      html: [
        o.text && `<p>${esc(o.text)}</p>`,
        o.note && `<p class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">${esc(o.note)}</p>`,
      ]
        .filter(Boolean)
        .join(""),
      icon: o.tone === "peligro" ? "warning" : "question",
      iconColor: o.tone === "peligro" ? "#dc2626" : "#0f766e",
      showCancelButton: true,
      confirmButtonText: o.yes,
      cancelButtonText: "No, volver",
      reverseButtons: true,
      focusCancel: o.tone === "peligro",
      buttonsStyling: false,
      customClass: {
        popup: "!rounded-3xl !p-6",
        title: "!text-xl !font-bold !text-foreground",
        htmlContainer: "!text-[15px] !text-slate-600",
        actions: "!mt-5 !w-full !flex-nowrap !gap-2 !px-2",
        confirmButton: `${BUTTON[o.tone ?? "normal"]} h-12 flex-1`,
        cancelButton: "btn-secundario h-12 flex-1",
      },
    }).then((r) => {
      if (!r.isConfirmed) return;
      form.dataset.ok = "1";
      form.requestSubmit();
    });
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
