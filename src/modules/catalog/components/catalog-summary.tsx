import type { CatalogSummary as Summary } from "../queries";
import { AddNameForm } from "./add-name-form";

export function CatalogSummary({ summary }: { summary: Summary }) {
  const blocks = [
    { kind: "category", title: "Categorías", rows: summary.categories.map((c) => ({ id: c.id, text: c.name, extra: `${c.products} productos` })) },
    { kind: "brand", title: "Marcas", rows: summary.brands.map((b) => ({ id: b.id, text: b.name, extra: `${b.products} productos` })) },
    {
      kind: "location",
      title: "Ubicaciones (pisos y vehículos)",
      rows: summary.locations.map((l) => ({ id: l.id, text: l.name, extra: l.type === "ALMACEN" ? "Almacén" : "Vehículo" })),
    },
  ] as const;

  return (
    <>
      {blocks.map((b) => (
        <div key={b.kind} className="tarjeta flex flex-col gap-3">
          <h2 className="font-semibold">{b.title}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {b.rows.map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-100 px-2 py-1">
                {r.text} <span className="text-muted">· {r.extra}</span>
              </li>
            ))}
          </ul>
          <AddNameForm kind={b.kind} />
        </div>
      ))}
    </>
  );
}
