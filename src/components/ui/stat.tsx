import Link from "next/link";

/** Small summary card (label + big figure, optional hint); a link when `href` is given. */
export function Stat({
  href,
  label,
  value,
  tone = "",
  hint,
}: {
  href?: string;
  label: string;
  value: string | number;
  tone?: string;
  hint?: string;
}) {
  const cls = "tarjeta flex flex-col gap-0.5 px-4 py-3";
  const body = (
    <>
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`cifra text-2xl ${tone}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-slate-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
