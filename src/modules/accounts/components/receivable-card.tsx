import Link from "next/link";
import { formatSoles } from "@/lib/money";
import type { ReceivableSummary } from "../queries";

/** Dark hero on Inicio: what customers owe, links to Deudores. */
export function ReceivableCard({ summary }: { summary: ReceivableSummary }) {
  return (
    <Link href="/deudores" className="flex flex-col gap-2.5 rounded-[20px] bg-slate-900 p-[18px] text-white">
      <span className="text-[13px] font-medium text-slate-300">Por cobrar a clientes</span>
      <span className="cifra text-4xl">{formatSoles(summary.total)}</span>
      <span className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200">
          {summary.debtors ? `${summary.debtors} cliente${summary.debtors === 1 ? "" : "s"} deben` : "Nadie debe"}
        </span>
        {summary.overLimit > 0 && (
          <span className="rounded-full bg-amber-950 px-2.5 py-1.5 text-xs text-amber-200">{summary.overLimit} pasaron su límite</span>
        )}
      </span>
    </Link>
  );
}
