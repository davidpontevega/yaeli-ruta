import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { waNumber } from "@/lib/phone";
import { orderText } from "../order-text";

type Missing = { supplierId: string; packagingId: string; quantity: number; productName: string; packagingName: string };

/** "Lo que falta, por proveedor": one card per supplier with something missing, its WhatsApp text (no costs) and "Crear lista". */
export function SupplierOrders({ suppliers, missing }: { suppliers: { id: string; name: string; phone: string | null }[]; missing: Missing[] }) {
  const cards = suppliers
    .map((s) => ({ ...s, lines: missing.filter((m) => m.supplierId === s.id) }))
    .filter((s) => s.lines.length)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-3">
      <h2 className="rotulo">Lo que falta, por proveedor</h2>
      {!cards.length && <EmptyState text="Todo tiene stock." tone="bg-emerald-50 text-emerald-700" />}
      {cards.map((s) => (
        <div key={s.id} className="tarjeta flex flex-col gap-3">
          <h3 className="font-bold">{s.name}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {s.lines.map((l) => (
              <li key={l.packagingId}>
                <span className="font-semibold">
                  {l.quantity} {l.packagingName}
                </span>{" "}
                · {l.productName}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/${s.phone ? waNumber(s.phone) : ""}?text=${encodeURIComponent(orderText(s.lines))}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secundario flex h-12 items-center justify-center text-sm"
            >
              Enviar por WhatsApp
            </a>
            <Link href={`/compras/nueva?proveedor=${s.id}`} className="btn-primario btn-proveedor flex h-12 items-center justify-center text-sm">
              Crear lista
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
