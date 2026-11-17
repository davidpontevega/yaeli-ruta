import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { formatSoles } from "@/lib/money";
import { Avatar } from "@/components/ui/avatar";
import type { SupplierStats } from "../queries";
import { SupplierPhoneForm } from "./supplier-phone-form";

const formatDay = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" });

export function SupplierList({ suppliers }: { suppliers: SupplierStats[] }) {
  if (!suppliers.length)
    return (
      <EmptyState text="Aún no hay proveedores. Crea el primero con «Nuevo proveedor»; también se crean solos al recibir mercadería con su nombre." />
    );
  return (
    <ul className="lista">
      {suppliers.map((s) => (
        <li key={s.id} className="fila flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Avatar name={s.name} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={`/stock?proveedor=${s.id}`} className="font-semibold leading-tight hover:text-primary">
                {s.name}
              </Link>
              <div className="flex flex-wrap gap-1">
                <span className="chip bg-slate-100 text-slate-700">
                  {s.purchases} compra{s.purchases === 1 ? "" : "s"}
                </span>
                {s.lastPurchase && <span className="chip bg-slate-100 text-slate-700">última {formatDay(new Date(s.lastPurchase))}</span>}
              </div>
            </div>
            <p className="cifra shrink-0 text-right text-lg">{formatSoles(s.total)}</p>
          </div>
          <SupplierPhoneForm id={s.id} phone={s.phone} />
        </li>
      ))}
    </ul>
  );
}
