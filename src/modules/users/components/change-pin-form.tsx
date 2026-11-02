"use client";

import { useActionState, useState } from "react";
import { changePin } from "../actions";
import { PinInput } from "@/components/ui/pin-input";

export function ChangePinForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(changePin, undefined);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secundario h-10 text-sm">
        Cambiar PIN
      </button>
    );

  if (state?.ok) return <p className="flex h-10 items-center text-sm text-primary">{state.ok}</p>;

  return (
    <form action={action} className="flex w-full flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="campo flex-1">
        Nuevo PIN
        <PinInput name="pin" autoFocus />
      </label>
      <button disabled={pending} className="btn-primario h-12">
        OK
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secundario h-12">
        ✕
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
