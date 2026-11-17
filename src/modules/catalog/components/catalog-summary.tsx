import Link from "next/link";
import { ICONS, IconTile } from "@/components/ui/avatar";
import type { CatalogSummary as Summary } from "../queries";
import { AddNameForm } from "./add-name-form";
import { setLocationCapacity } from "../actions";

const TAG = "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01";
const KEY = "M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.7 5.7L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.6a1 1 0 0 1 .3-.7l6-6A6 6 0 1 1 21 9z";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Count chip next to each name: grey when nothing uses it. */
function NameChips({ rows }: { rows: { id: string; name: string; products: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-1.5 rounded-full border border-border bg-slate-50 py-1 pr-1 pl-3">
          <span className="font-medium">{r.name}</span>
          <span
            title={plural(r.products, "producto", "productos")}
            className={`cifra min-w-6 rounded-full px-1.5 text-center text-xs leading-5 ${r.products ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-500"}`}
          >
            {r.products}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Card({ icon, title, count, children }: { icon: string; title: string; count: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <IconTile d={icon} />
        <h2 className="flex-1 font-bold">{title}</h2>
        <span className="chip bg-slate-100 text-slate-700">{count}</span>
      </header>
      {children}
    </section>
  );
}

/** Settings home: links to users and suppliers, then categories, brands and locations with their quick-add forms. */
export function CatalogSummary({ summary }: { summary: Summary }) {
  const links = [
    { href: "/usuarios", icon: KEY, title: "Usuarios y PIN", hint: "Quién entra al sistema y con qué rol" },
    { href: "/proveedores", icon: ICONS.truck, title: "Proveedores", hint: "Teléfonos, compras y listas de pedido" },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="tarjeta group flex items-center gap-3 transition hover:border-teal-300">
            <IconTile d={l.icon} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{l.title}</span>
              <span className="block truncate text-sm text-muted">{l.hint}</span>
            </span>
            <span aria-hidden className="text-lg text-muted transition group-hover:translate-x-0.5 group-hover:text-primary">
              →
            </span>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card icon={ICONS.box} title="Categorías" count={plural(summary.categories.length, "categoría", "categorías")}>
          <NameChips rows={summary.categories} />
          <AddNameForm kind="category" />
        </Card>
        <Card icon={TAG} title="Marcas" count={plural(summary.brands.length, "marca", "marcas")}>
          <NameChips rows={summary.brands} />
          <AddNameForm kind="brand" />
        </Card>
        <Card icon={ICONS.pin} title="Pisos y vehículos" count={plural(summary.locations.length, "ubicación", "ubicaciones")}>
          <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-border">
            {summary.locations.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <span className="font-medium">{l.name}</span>
                <span className={`chip ${l.type === "ALMACEN" ? "bg-teal-50 text-teal-800" : "bg-sky-50 text-sky-800"}`}>
                  {l.type === "ALMACEN" ? "Almacén" : "Vehículo"}
                </span>
                {l.type === "VEHICULO" && (
                  <form action={setLocationCapacity} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <input
                      name="capacityKg"
                      type="number"
                      min={1}
                      max={100000}
                      inputMode="numeric"
                      defaultValue={l.capacityKg ?? ""}
                      placeholder="kg máx."
                      aria-label={`Carga máxima de ${l.name} en kg`}
                      className="h-9 w-24 rounded-xl border border-border bg-surface px-3 text-right"
                    />
                    <span className="text-xs text-muted">kg</span>
                    <button className="btn-secundario h-9 px-3 text-sm">Guardar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <AddNameForm kind="location" />
        </Card>
      </div>
    </>
  );
}
