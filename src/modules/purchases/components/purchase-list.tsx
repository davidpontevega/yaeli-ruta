import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { formatKg } from "@/lib/weight";
import type { PurchaseRow } from "../queries";

const STATUS = {
  BORRADOR: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  RECIBIDA: { label: "Recibida", className: "bg-emerald-100 text-emerald-800" },
  ANULADA: { label: "Anulada", className: "bg-slate-200 text-muted" },
} as const;
const formatDay = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit" });

export function PurchaseList({ purchases }: { purchases: PurchaseRow[] }) {
  if (!purchases.length) return <p className="tarjeta text-muted">Aún no hay compras. Arma la primera lista con «+ Nueva compra».</p>;
  return (
    <ul className="flex flex-col gap-2">
      {purchases.map((p) => (
        <li key={p.id}>
          <Link href={`/compras/${p.id}`} className={`tarjeta flex items-center gap-3 ${p.status === "ANULADA" ? "opacity-50" : ""}`}>
            <span className="w-10 shrink-0 text-sm text-muted">#{p.number}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{p.type === "RECOJO" ? (p.vehicleName ?? "Recojo") : (p.supplierName ?? "Proveedor")}</p>
              <p className="text-xs text-muted">
                {formatDay(new Date(p.createdAt))} · {p.type === "RECOJO" ? "Recojo" : "Envía proveedor"} · {p.lines} línea{p.lines === 1 ? "" : "s"}
                {p.weight > 0 && ` · ${formatKg(p.weight)}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[p.status].className}`}>{STATUS[p.status].label}</span>
              <p className="font-semibold">{formatSoles(p.total)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
