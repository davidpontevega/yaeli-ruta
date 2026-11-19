"use client";

import { useActionState, useState } from "react";
import { menusFor } from "@/lib/menus";
import type { Role } from "@/server/db/schema";
import { saveHiddenMenus } from "../actions";

type Props = { user: { id: string; name: string; role: Role; isAdmin: boolean; hiddenMenus: string[] } };

/** A check per screen the role allows (checked = sees it), grouped like the menu. Sends the unchecked ones as `hidden`. */
export function MenuVisibilityForm({ user }: Props) {
  const [state, action, pending] = useActionState(saveHiddenMenus, undefined);
  const [hidden, setHidden] = useState(() => new Set(user.hiddenMenus));
  const menus = menusFor(user.role);
  const groups = [...new Set(menus.map((m) => m.group))];
  const toggle = (key: string, visible: boolean) =>
    setHidden((h) => {
      const next = new Set(h);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <form action={action} className="tarjeta flex flex-col gap-4">
      <h2 className="font-semibold">Pantallas que ve {user.name}</h2>
      <input type="hidden" name="userId" value={user.id} />
      {[...hidden].map((k) => (
        <input key={k} type="hidden" name="hidden" value={k} />
      ))}
      {groups.map((g) => (
        <fieldset key={g} className="flex flex-col gap-1">
          <legend className="rotulo pb-1">{g}</legend>
          {menus
            .filter((m) => m.group === g)
            .map((m) => {
              const locked = user.isAdmin && m.key === "ajustes";
              return (
                <label key={m.key} className="flex min-h-11 items-center gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={locked || !hidden.has(m.key)}
                    disabled={locked}
                    onChange={(e) => toggle(m.key, e.target.checked)}
                  />
                  {m.label}
                  {locked && <span className="text-xs text-muted">(entrada a Menús)</span>}
                </label>
              );
            })}
        </fieldset>
      ))}
      <p role="status" className={`min-h-5 text-sm ${state?.error ? "text-red-600" : "text-primary"}`}>
        {state?.error ?? state?.ok}
      </p>
      <button disabled={pending} className="btn-primario h-12">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
