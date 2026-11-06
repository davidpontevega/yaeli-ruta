import { formatSoles } from "@/lib/money";
import { formatDate, formatQty } from "../format";
import { MOVEMENT_LIMIT, type Movement } from "../queries";

const TYPE: Record<Movement["type"], string> = { INGRESO: "Compra", SALDO_INICIAL: "Saldo inicial" };
const formatWhen = (d: Date) => d.toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" });

export function MovementList({ movements, packagings }: { movements: Movement[]; packagings: { name: string; factor: number }[] }) {
  if (!movements.length) return <p className="tarjeta text-muted">Este producto aún no tiene movimientos.</p>;
  const qty = (n: number) => `${n < 0 ? "−" : "+"}${formatQty(Math.abs(n), packagings)}`;
  return (
    <>
      {movements.length === MOVEMENT_LIMIT && <p className="text-sm text-muted">Se muestran los últimos {MOVEMENT_LIMIT} movimientos.</p>}
      <ul className="flex flex-col gap-2">
        {movements.map((m) => (
          <li key={m.id} className="tarjeta flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-tight">
                {TYPE[m.type]}
                {m.supplier && <span className="font-normal"> · {m.supplier}</span>}
                {m.document && <span className="font-normal text-muted"> · {m.document}</span>}
              </p>
              <p className="text-xs text-muted">
                {formatWhen(new Date(m.createdAt))} · {m.location}
                {m.expiresOn && ` · vence ${formatDate(m.expiresOn)}`} · {formatSoles(m.unitCost)} c/u
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`font-semibold ${m.quantity < 0 ? "text-red-600" : "text-emerald-700"}`}>{qty(m.quantity)}</p>
              <p className="text-xs text-muted">Saldo {m.balance ? formatQty(m.balance, packagings) : "0"}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
