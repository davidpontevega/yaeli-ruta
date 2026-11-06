import { formatSoles } from "@/lib/money";
import type { SupplierStats } from "../queries";
import { SupplierPhoneForm } from "./supplier-phone-form";

const formatDay = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" });

export function SupplierList({ suppliers }: { suppliers: SupplierStats[] }) {
  if (!suppliers.length)
    return <p className="tarjeta text-muted">Aún no hay proveedores. Se crean solos al registrar una compra con el nombre del proveedor.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {suppliers.map((s) => (
        <li key={s.id} className="tarjeta flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{s.name}</p>
            <p className="shrink-0 text-right font-semibold">{formatSoles(s.total)}</p>
          </div>
          <p className="text-xs text-muted">
            {s.purchases} compra{s.purchases === 1 ? "" : "s"}
            {s.lastPurchase && ` · última ${formatDay(new Date(s.lastPurchase))}`}
          </p>
          <SupplierPhoneForm id={s.id} phone={s.phone} />
        </li>
      ))}
    </ul>
  );
}
