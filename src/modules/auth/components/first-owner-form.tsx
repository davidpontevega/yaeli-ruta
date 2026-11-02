"use client";

import { useActionState } from "react";
import { PinInput } from "@/components/ui/pin-input";
import { createFirstOwner } from "../actions";

export function FirstOwnerForm() {
  const [state, action, pending] = useActionState(createFirstOwner, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted">Primera vez: crea la cuenta del dueño.</p>
      <label className="campo">
        Tu nombre
        <input name="name" required maxLength={40} autoComplete="name" />
      </label>
      <label className="campo">
        PIN (4 a 6 números)
        <PinInput name="pin" />
      </label>
      <label className="campo">
        Repite el PIN
        <PinInput name="pin2" />
      </label>
      <p role="alert" className="min-h-5 text-sm text-red-600">
        {state?.error}
      </p>
      <button disabled={pending} className="btn-primario h-12">
        {pending ? "Creando…" : "Crear y entrar"}
      </button>
    </form>
  );
}
