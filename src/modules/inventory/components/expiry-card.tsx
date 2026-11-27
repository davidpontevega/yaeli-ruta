import Link from "next/link";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Hero on Inicio: expired and soon-to-expire lots, links to Por vencer. Red with expired lots, amber with lots expiring in 30 days. */
export function ExpiryCard({ expired, within7, within30 }: { expired: number; within7: number; within30: number }) {
  const tone = expired ? "bg-red-800" : within30 ? "bg-amber-700" : "bg-emerald-800";
  const chip = "rounded-full bg-black/20 px-2.5 py-1.5 text-xs text-white";
  return (
    <Link href="/vencimientos" className={`flex flex-col gap-2.5 rounded-[20px] p-[18px] text-white ${tone}`}>
      <span className="text-[13px] font-medium text-white/80">Por vencer y vencidos</span>
      <span className="cifra text-4xl md:text-[28px]">
        {expired
          ? plural(expired, "lote vencido", "lotes vencidos")
          : within30
            ? plural(within30, "lote por vencer", "lotes por vencer")
            : "Todo al día"}
      </span>
      <span className="flex flex-wrap gap-2">
        {expired > 0 && within30 > 0 && <span className={chip}>{plural(within30, "por vencer", "por vencer")} en 30 días</span>}
        {within7 > 0 && <span className={chip}>{plural(within7, "vence", "vencen")} esta semana</span>}
        {!expired && !within30 && <span className={chip}>Nada vence en 30 días</span>}
      </span>
    </Link>
  );
}
