"use client";

import { useState, useTransition } from "react";

type Created = { error?: string; ok?: string; id?: string; name?: string };

/**
 * Create a supplier without leaving the screen. It is not a <form> (it may sit inside another form):
 * the button calls the server action, which arrives as a prop from the page.
 * `open`: show the fields right away (Proveedores page) instead of behind "+ Nuevo proveedor".
 */
export function SupplierQuickAdd({
  action,
  onCreated,
  open: startOpen = false,
}: {
  action: (state: Created | undefined, form: FormData) => Promise<Created>;
  onCreated?: (s: { id: string; name: string }) => void;
  open?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<Created | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("phone", phone);
      const r = await action(undefined, fd);
      setMsg(r);
      // An existing supplier with that name is also good: select it.
      if (r.id && r.name) {
        onCreated?.({ id: r.id, name: r.name });
        if (!r.error) {
          setName("");
          setPhone("");
          if (!startOpen) setOpen(false);
        }
      }
    });

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-suave h-12 shrink-0 px-3 text-sm">
        + Nuevo
      </button>
    );

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
          placeholder="Nombre del proveedor (ej. ALICORP)"
          aria-label="Nombre del proveedor"
          maxLength={80}
          className="h-11 min-w-0 flex-[2] basis-48 rounded-xl border border-border bg-surface px-3"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono (opcional)"
          aria-label="Teléfono del proveedor"
          inputMode="tel"
          maxLength={30}
          className="h-11 min-w-0 flex-1 basis-36 rounded-xl border border-border bg-surface px-3"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={pending || name.trim().length < 2} className="btn-primario h-10 px-4 text-sm">
          {pending ? "Guardando…" : "Crear proveedor"}
        </button>
        {!startOpen && (
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm font-medium text-muted hover:bg-slate-100">
            Cancelar
          </button>
        )}
        {msg && (msg.error || msg.ok) && <span className={`text-sm ${msg.error ? "text-amber-700" : "text-teal-800"}`}>{msg.error ?? msg.ok}</span>}
      </div>
    </div>
  );
}
