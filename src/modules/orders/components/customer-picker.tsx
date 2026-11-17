"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";

const MAX_RESULTS = 12;
const MAX_BROWSE = 24;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Option = { id: string; name: string; phone: string | null; routeName: string };

/** In-memory search over active customers; a result opens the order form for that customer. */
export function CustomerPicker({ customers }: { customers: Option[] }) {
  const [q, setQ] = useState("");
  const term = fold(q.trim());
  const digits = q.replace(/\D/g, "");
  // No search yet: show everyone (first ones) so a regular customer is one tap away.
  const results = (
    term.length < 2 ? customers : customers.filter((c) => fold(c.name).includes(term) || (digits.length >= 3 && c.phone?.includes(digits)))
  ).slice(0, term.length < 2 ? MAX_BROWSE : MAX_RESULTS);
  return (
    <div className="flex flex-col gap-3">
      <div className="tarjeta flex flex-col gap-2 p-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o teléfono del cliente"
          aria-label="Buscar cliente"
          className="h-12 rounded-xl border border-border bg-slate-50 px-3"
        />
      </div>
      {results.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((c) => (
            <li key={c.id}>
              <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="tarjeta flex items-center gap-3 px-3.5 py-3 transition hover:border-teal-300">
                <Avatar name={c.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold leading-tight">{c.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <span className="chip bg-teal-50 text-teal-800">{c.routeName}</span>
                    {c.phone && <span className="chip bg-slate-100 text-slate-600">{c.phone}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {term.length >= 2 && !results.length && <p className="tarjeta text-sm text-muted">No se encontró. Créalo primero en Clientes.</p>}
      {term.length < 2 && customers.length > MAX_BROWSE && (
        <p className="text-center text-xs text-muted">
          Se muestran {MAX_BROWSE} de {customers.length}: escribe para buscar el resto.
        </p>
      )}
    </div>
  );
}
