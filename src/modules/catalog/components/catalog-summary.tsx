import Link from "next/link";
import type { CatalogSummary as Summary } from "../queries";
import { AddNameForm } from "./add-name-form";
import { setLocationCapacity } from "../actions";

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
      <Link href="/proveedores" className="tarjeta flex items-center justify-between font-semibold">
        Proveedores <span className="text-muted">→</span>
      </Link>
      <div className="grid items-start gap-4 lg:grid-cols-2">
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
            {b.kind === "location" &&
              summary.locations
                .filter((l) => l.type === "VEHICULO")
                .map((l) => (
                  <form key={l.id} action={setLocationCapacity} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="id" value={l.id} />
                    <span className="min-w-0 flex-1">{l.name}: carga máx. kg</span>
                    <input
                      name="capacityKg"
                      type="number"
                      min={1}
                      max={100000}
                      inputMode="numeric"
                      defaultValue={l.capacityKg ?? ""}
                      placeholder="Sin dato"
                      aria-label={`Carga máxima de ${l.name} en kg`}
                      className="h-10 w-28 rounded-xl border border-border bg-surface px-3"
                    />
                    <button className="btn-secundario h-10 text-sm">Guardar</button>
                  </form>
                ))}
            <AddNameForm kind={b.kind} />
          </div>
        ))}
      </div>
    </>
  );
}
