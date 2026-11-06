import Link from "next/link";

type Alert = { href: string; count: number; label: string; tone: string };

export function HomeAlerts({ expired, within30, lowStock }: { expired: number; within30: number; lowStock: number }) {
  const alerts: Alert[] = [
    { href: "/vencimientos", count: expired, label: "lotes vencidos", tone: "border-red-300 bg-red-50 text-red-800" },
    { href: "/vencimientos", count: within30, label: "lotes vencen en 30 días", tone: "border-amber-300 bg-amber-50 text-amber-800" },
    { href: "/stock", count: lowStock, label: "productos con stock bajo", tone: "border-orange-300 bg-orange-50 text-orange-800" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {alerts.map((a) => (
        <Link key={a.label} href={a.href} className={`rounded-2xl border p-4 ${a.count ? a.tone : "border-border bg-surface text-muted"}`}>
          <p className="text-3xl font-bold">{a.count}</p>
          <p className="text-sm font-medium">{a.count ? a.label : `${a.label} · Todo bien`}</p>
        </Link>
      ))}
    </div>
  );
}
