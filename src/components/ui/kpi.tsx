import Link from "next/link";

/** Desktop indicator card: label, big figure, optional detail line and extra content (e.g. a progress bar). */
export function Kpi({
  href,
  label,
  value,
  detail,
  valueClass = "",
  detailClass = "text-muted",
  children,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  detail?: string;
  valueClass?: string;
  detailClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="tarjeta flex flex-col gap-1.5 px-[18px] transition hover:border-slate-300">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`cifra text-[28px] leading-tight ${valueClass}`}>{value}</span>
      {children}
      {detail && <span className={`text-xs ${detailClass}`}>{detail}</span>}
    </Link>
  );
}
