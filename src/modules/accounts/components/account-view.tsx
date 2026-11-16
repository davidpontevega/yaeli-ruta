import { formatDate } from "@/lib/date";
import { formatSoles } from "@/lib/money";
import { ACCOUNT_MOVEMENT_LIMIT, type Account } from "../queries";

const TYPE: Record<string, string> = { SALDO_INICIAL: "Deuda inicial", CARGO: "Entrega", ABONO: "Cobro", AJUSTE: "Ajuste" };
const METHOD: Record<string, string> = { EFECTIVO: "Efectivo", YAPE: "Yape", PLIN: "Plin", TRANSFERENCIA: "Transferencia" };

/** Balance header + movements newest first, each with the balance after it. */
export function AccountView({ account, creditLimit }: { account: Account; creditLimit: number | null }) {
  const { balance, ageDays, movements } = account;
  return (
    <div className="flex flex-col gap-3">
      <div className="tarjeta flex flex-col gap-1">
        <p className={`text-3xl font-bold ${balance > 0 ? "text-red-600" : "text-primary"}`}>
          {balance > 0 ? `Debe ${formatSoles(balance)}` : "Al día"}
        </p>
        <p className="text-sm text-muted">
          {ageDays !== null && `Debe desde hace ${ageDays} día${ageDays === 1 ? "" : "s"}`}
          {ageDays !== null && creditLimit !== null && " · "}
          {creditLimit !== null && (
            <span className={balance > creditLimit ? "font-semibold text-amber-700" : ""}>Límite {formatSoles(creditLimit)}</span>
          )}
        </p>
      </div>
      {movements.length ? (
        <ul className="flex flex-col gap-2">
          {movements.map((m) => (
            <li key={m.id} className="tarjeta flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{TYPE[m.type]}</p>
                <p className="text-xs text-muted">
                  {formatDate(m.date)}
                  {m.method && ` · ${METHOD[m.method]}`}
                  {m.note && ` · ${m.note}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-semibold ${m.amount > 0 ? "text-red-600" : "text-primary"}`}>
                  {m.amount > 0 ? "+" : "−"}
                  {formatSoles(Math.abs(m.amount))}
                </p>
                <p className="text-xs text-muted">Saldo {formatSoles(m.balance)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tarjeta text-muted">Sin movimientos.</p>
      )}
      {movements.length === ACCOUNT_MOVEMENT_LIMIT && <p className="text-xs text-muted">Se muestran los últimos {ACCOUNT_MOVEMENT_LIMIT}.</p>}
    </div>
  );
}
