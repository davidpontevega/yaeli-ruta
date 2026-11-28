"use client";

import { useActionState, type SelectHTMLAttributes } from "react";
import { setSheetDriver } from "../actions";

type Driver = { id: string; name: string };

/** "Quién reparte": empty = the owner, or an active REPARTIDOR. */
export function DriverSelect({ drivers, ...props }: { drivers: Driver[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="campo-etiqueta">
      Quién reparte
      <select name="driverId" {...props}>
        <option value="">Yo (dueño)</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Changes who delivers a sheet (until LIQUIDADA); saves on change. */
export function SheetDriverForm({ sheetId, driverId, drivers }: { sheetId: string; driverId: string | null; drivers: Driver[] }) {
  const [state, action, pending] = useActionState(setSheetDriver, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 print:hidden">
      <input type="hidden" name="sheetId" value={sheetId} />
      <DriverSelect
        key={driverId ?? ""}
        drivers={drivers}
        defaultValue={driverId ?? ""}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
