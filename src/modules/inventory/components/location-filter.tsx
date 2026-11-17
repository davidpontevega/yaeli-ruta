import Link from "next/link";

/** Floor pills (?piso=<location id>); empty = all. One tap, no "Ver" button. */
export function LocationFilter({ locations, value }: { locations: { id: string; name: string }[]; value: string }) {
  return (
    <nav aria-label="Piso" className="flex flex-wrap gap-2">
      {[{ id: "", name: "Todos los pisos" }, ...locations].map((l) => (
        <Link
          key={l.id}
          href={l.id ? `?piso=${l.id}` : "?"}
          aria-current={l.id === value ? "page" : undefined}
          className={`flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold ${l.id === value ? "border-slate-900 bg-slate-900 text-white" : "border-border bg-surface text-slate-700"}`}
        >
          {l.name}
        </Link>
      ))}
    </nav>
  );
}
