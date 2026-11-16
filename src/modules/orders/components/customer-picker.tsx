"use client";

import Link from "next/link";
import { useState } from "react";

const MAX_RESULTS = 8;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Option = { id: string; name: string; phone: string | null; routeName: string };

/** In-memory search over active customers; a result opens the order form for that customer. */
export function CustomerPicker({ customers }: { customers: Option[] }) {
  const [q, setQ] = useState("");
  const term = fold(q.trim());
  const digits = q.replace(/\D/g, "");
  const results =
    term.length < 2
      ? []
      : customers.filter((c) => fold(c.name).includes(term) || (digits.length >= 3 && c.phone?.includes(digits))).slice(0, MAX_RESULTS);
  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nombre o teléfono del cliente"
        aria-label="Buscar cliente"
        className="h-12 rounded-xl border border-border bg-surface px-3"
      />
      {results.map((c) => (
        <Link key={c.id} href={`/pedidos/nuevo?cliente=${c.id}`} className="rounded-xl border border-border px-3 py-2 text-sm active:bg-slate-100">
          <span className="font-semibold">{c.name}</span> <span className="text-muted">· {c.routeName}</span>
          {c.phone && <span className="text-muted"> · {c.phone}</span>}
        </Link>
      ))}
      {term.length >= 2 && !results.length && <p className="text-sm text-muted">No se encontró. Créalo primero en Clientes.</p>}
    </div>
  );
}
