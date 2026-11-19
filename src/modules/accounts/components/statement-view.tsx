import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/ui/logo";
import { formatDate } from "@/lib/date";
import { formatSoles } from "@/lib/money";
import { paymentLabel } from "@/lib/payment";
import { waNumber } from "@/lib/phone";
import type { Statement } from "../queries";
import { MOVEMENT_LABEL } from "./account-view";
import { StatementShare } from "./statement-share";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatSoles(Math.abs(n))}`;

/** Printable account statement: header, GET period filter, summary and the movements of the period. */
export function StatementView({
  customer,
  statement,
  from,
  to,
  today,
}: {
  customer: { name: string; phone: string | null };
  statement: Statement;
  from: string;
  to: string;
  today: string;
}) {
  const { opening, charges, payments, adjustments, closing, rows } = statement;
  const period = `${formatDate(from)} al ${formatDate(to)}`;
  const summary: [string, string][] = [
    ["Saldo anterior", formatSoles(opening)],
    ["Entregas", formatSoles(charges)],
    ["Cobros", formatSoles(payments)],
    ["Ajustes", signed(adjustments)],
    [`Saldo al ${formatDate(to)}`, formatSoles(closing)],
  ];
  const text = [
    BRAND.company,
    `Estado de cuenta de ${customer.name}`,
    `Periodo: ${period}`,
    ...summary.map(([k, v]) => `${k}: ${v}`),
    "Te envío el detalle en PDF.",
  ].join("\n");
  const waHref = `https://wa.me/${customer.phone ? waNumber(customer.phone) : ""}?text=${encodeURIComponent(text)}`;

  return (
    <div className="flex flex-col gap-3">
      <form className="filtros print:hidden">
        <input type="date" name="desde" defaultValue={from} max={today} aria-label="Desde" className="filtro" />
        <input type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta" className="filtro" />
        <button className="btn-primario h-11 px-5">Ver</button>
      </form>
      <StatementShare waHref={waHref} />

      <div className="tarjeta flex flex-col gap-3 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-2">
            <Logo size={44} />
            <p className="text-sm text-muted">Estado de cuenta · {period}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{customer.name}</p>
            {customer.phone && <p className="text-muted">{customer.phone}</p>}
            <p className="text-xs text-muted">Emitido el {formatDate(today)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
          {summary.map(([k, v], i) => (
            <div key={k} className={i === summary.length - 1 ? "font-bold" : ""}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="cifra">{v}</dd>
            </div>
          ))}
        </dl>

        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted">
                <th className="py-1 pr-2">Fecha</th>
                <th className="py-1 pr-2">Tipo</th>
                <th className="py-1 pr-2">Detalle</th>
                <th className="py-1 pr-2 text-right">Monto</th>
                <th className="py-1 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b align-top">
                  <td className="py-1 pr-2 whitespace-nowrap">{formatDate(m.date)}</td>
                  <td className="py-1 pr-2">{MOVEMENT_LABEL[m.type]}</td>
                  <td className="py-1 pr-2">
                    {[m.orderNumber && `Pedido #${m.orderNumber}`, m.method && paymentLabel(m.method), m.note].filter(Boolean).join(" · ")}
                  </td>
                  <td className="py-1 pr-2 text-right whitespace-nowrap">{signed(m.amount)}</td>
                  <td className="py-1 text-right whitespace-nowrap">{formatSoles(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">Sin movimientos en este periodo</p>
        )}
      </div>
    </div>
  );
}
