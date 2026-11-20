import { ShareButtons } from "@/components/ui/share-buttons";
import { Stat } from "@/components/ui/stat";
import { formatDate } from "@/lib/date";
import { formatQty } from "@/lib/quantity";
import { formatKg } from "@/lib/weight";
import type { SheetPicking } from "../queries";

type Header = { number: number; routeName: string; date: string; vehicleName: string; capacityKg: number | null };

/** Picking by floor (FEFO lot to take), shortages and load weight vs the vehicle. Prints only the header and the picking. */
export function PickingList({ sheet, picking }: { sheet: Header; picking: SheetPicking }) {
  const qty = (productId: string, base: number) => formatQty(base, picking.packagings[productId] ?? []);
  const expiry = (d: string | null) => (d ? `vence ${formatDate(d)}` : "sin fecha");
  const title = `Hoja de ruta #${sheet.number} · ${sheet.routeName}`;
  const sub = `${formatDate(sheet.date)} · ${sheet.vehicleName}`;
  const { grams, noWeight } = picking.weight;
  const capacity = sheet.capacityKg === null ? null : sheet.capacityKg * 1000;
  const over = capacity !== null && grams > capacity;

  const text = [
    title,
    sub,
    ...picking.floors.flatMap((f) => [
      "",
      `*${f.locationName}*`,
      ...f.items.map((i) => `- ${i.productName}: ${qty(i.productId, i.baseQty)} (${expiry(i.expiresOn)})`),
    ]),
    ...(picking.short.length ? ["", "*Falta*", ...picking.short.map((s) => `- ${s.productName}: ${qty(s.productId, s.missing)}`)] : []),
  ].join("\n");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 print:hidden">
        <Stat
          label={capacity === null ? "Peso" : "Peso / capacidad"}
          value={capacity === null ? formatKg(grams) : `${formatKg(grams)} / ${formatKg(capacity)}`}
          tone={over ? "text-amber-700" : ""}
          hint={noWeight ? `${noWeight} línea${noWeight === 1 ? "" : "s"} sin peso` : undefined}
        />
        <div className="flex flex-col justify-center gap-1">
          {over && <span className="chip self-start bg-amber-100 text-amber-800">Pasa la capacidad del vehículo</span>}
          {picking.short.length > 0 && <span className="chip self-start bg-red-100 text-red-700">Falta stock de {picking.short.length}</span>}
        </div>
      </div>
      <ShareButtons waHref={`https://wa.me/?text=${encodeURIComponent(text)}`} />

      <div className="tarjeta flex flex-col gap-3 print:border-0 print:p-0 print:shadow-none">
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="text-sm text-muted">{sub}</p>
        </div>
        {!picking.floors.length && !picking.short.length ? (
          <p className="text-sm text-muted">Nada que cargar.</p>
        ) : (
          <table className="w-full text-sm">
            {picking.floors.map((f) => (
              <tbody key={f.locationId}>
                <tr>
                  <th colSpan={3} className="pt-3 pb-1 text-left font-bold">
                    {f.locationName}
                  </th>
                </tr>
                {f.items.map((i) => (
                  <tr key={`${i.productId}-${i.expiresOn}`} className="border-b align-top">
                    <td className="py-1 pr-2">{i.productName}</td>
                    <td className="py-1 pr-2 whitespace-nowrap text-muted">{expiry(i.expiresOn)}</td>
                    <td className="py-1 text-right font-semibold">{qty(i.productId, i.baseQty)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            {picking.short.length > 0 && (
              <tbody className="text-red-700">
                <tr>
                  <th colSpan={3} className="pt-3 pb-1 text-left font-bold">
                    Falta
                  </th>
                </tr>
                {picking.short.map((s) => (
                  <tr key={s.productId} className="border-b">
                    <td colSpan={2} className="py-1 pr-2">
                      {s.productName}
                    </td>
                    <td className="py-1 text-right font-semibold">{qty(s.productId, s.missing)}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
