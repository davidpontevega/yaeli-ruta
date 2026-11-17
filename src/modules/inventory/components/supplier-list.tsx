import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { formatSoles } from "@/lib/money";
import type { SupplierStats } from "../queries";
import { SupplierPhoneForm } from "./supplier-phone-form";

const formatDay = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" });
/** wa.me needs the country code: a 9-digit Peruvian mobile gets 51 in front. */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 9 ? `51${d}` : d;
};

/** Per supplier: active products and how many are low or out of stock (from the stock list). */
export type SupplierProducts = Record<string, { products: number; missing: number }>;

export function SupplierList({ suppliers, products }: { suppliers: SupplierStats[]; products: SupplierProducts }) {
  if (!suppliers.length)
    return (
      <EmptyState text="Aún no hay proveedores. Crea el primero con «Nuevo proveedor»; también se crean solos al recibir mercadería con su nombre." />
    );
  const toOrder = suppliers.filter((s) => products[s.id]?.missing).length;
  const noPhone = suppliers.filter((s) => !s.phone).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat label="Proveedores" value={suppliers.length} />
        <Stat href="/stock?falta=1" label="Con algo por pedir" value={toOrder} tone={toOrder ? "text-amber-700" : ""} />
        <Stat label="Comprado en total" value={formatSoles(suppliers.reduce((s, x) => s + x.total, 0))} tone="text-primary" />
        <Stat label="Sin teléfono" value={noPhone} tone={noPhone ? "text-red-700" : ""} />
      </div>
      <ul className="flex flex-col gap-3">
        {suppliers.map((s) => {
          const p = products[s.id] ?? { products: 0, missing: 0 };
          return (
            <li key={s.id} className="tarjeta flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-base font-bold leading-tight">{s.name}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="chip bg-slate-100 text-slate-700">
                      {p.products} producto{p.products === 1 ? "" : "s"}
                    </span>
                    {p.missing > 0 && <span className="chip bg-amber-100 text-amber-800">{p.missing} por pedir</span>}
                    <span className="chip bg-slate-100 text-slate-700">
                      {s.purchases} ingreso{s.purchases === 1 ? "" : "s"}
                    </span>
                    {s.lastPurchase && <span className="chip bg-slate-100 text-slate-700">último {formatDay(new Date(s.lastPurchase))}</span>}
                    {s.phone ? (
                      <span className="chip bg-teal-50 text-teal-800">{s.phone}</span>
                    ) : (
                      <span className="chip bg-red-50 text-red-700">sin teléfono</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-[11px] text-muted">Comprado</span>
                  <span className="cifra text-lg">{formatSoles(s.total)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/compras/nueva?proveedor=${s.id}`}
                  className={`${p.missing ? "btn-primario" : "btn-suave"} flex h-10 items-center px-3.5 text-sm`}
                >
                  Armar lista{p.missing ? ` · ${p.missing}` : ""}
                </Link>
                <Link href={`/stock?proveedor=${s.id}`} className="btn-secundario flex h-10 items-center px-3.5 text-sm">
                  Ver stock
                </Link>
                {s.phone && (
                  <>
                    <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="btn-secundario flex h-10 items-center px-3.5 text-sm">
                      Llamar
                    </a>
                    <a
                      href={`https://wa.me/${waNumber(s.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-10 items-center rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      WhatsApp
                    </a>
                  </>
                )}
              </div>

              {/* Phone: open when missing, tucked away otherwise. */}
              <details open={!s.phone} className="group rounded-xl bg-slate-50 px-3 py-2">
                <summary className="cursor-pointer list-none text-sm font-medium text-muted">
                  {s.phone ? "Cambiar teléfono" : "Agregar teléfono"}
                </summary>
                <div className="mt-2">
                  <SupplierPhoneForm id={s.id} phone={s.phone} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
