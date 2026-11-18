import Link from "next/link";
import { Avatar, Glyph, ICONS } from "@/components/ui/avatar";
import { formatSoles } from "@/lib/money";
import { waNumber } from "@/lib/phone";

type Customer = { id: string; name: string; phone: string | null; routeName: string; active: boolean };

/** Top card of the customer screens: who, route, debt, and shortcuts to the other customer screens. `here` hides its own link. */
export function CustomerHeader({ customer: c, balance, here }: { customer: Customer; balance: number; here: "ficha" | "cuenta" }) {
  const link = "btn-secundario flex h-10 items-center gap-1.5 px-3.5 text-sm";
  return (
    <div className="tarjeta flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={c.name} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight md:text-[26px]">{c.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.routeName && <span className="chip bg-teal-50 text-teal-800">{c.routeName}</span>}
            {c.phone && <span className="chip bg-slate-100 text-slate-700">{c.phone}</span>}
            {!c.active && <span className="chip bg-slate-200 text-slate-700">inactivo</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[11px] text-muted">{balance > 0 ? "Debe" : "Cuenta"}</span>
          <span className={`cifra text-lg ${balance > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {balance > 0 ? formatSoles(balance) : "Al día"}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.active && (
          <Link href={`/pedidos/nuevo?cliente=${c.id}`} className="btn-primario flex h-10 items-center gap-1.5 px-3.5 text-sm">
            <Glyph d={ICONS.plus} />
            Nuevo pedido
          </Link>
        )}
        {here !== "cuenta" && (
          <Link href={`/clientes/${c.id}/cuenta`} className={link}>
            Cuenta y pagos
          </Link>
        )}
        <Link href={`/clientes/${c.id}/estado`} className={link}>
          Estado de cuenta
        </Link>
        {here !== "ficha" && (
          <Link href={`/clientes/${c.id}`} className={link}>
            <Glyph d={ICONS.pencil} />
            Editar
          </Link>
        )}
        {c.phone && (
          <a
            href={`https://wa.me/${waNumber(c.phone)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
