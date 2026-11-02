"use client";

import { useActionState } from "react";
import { createUser } from "../actions";
import { PinInput } from "@/components/ui/pin-input";

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="tarjeta flex flex-col gap-3">
      <h2 className="font-semibold">Nuevo usuario</h2>
      <label className="campo">
        Nombre
        <input name="name" required maxLength={40} />
      </label>
      <label className="campo">
        Rol
        <select name="role" defaultValue="REPARTIDOR">
          <option value="REPARTIDOR">Repartidor</option>
          <option value="DUENO">Dueño</option>
        </select>
      </label>
      <label className="campo">
        PIN (4 a 6 números)
        <PinInput name="pin" />
      </label>
      <p role="status" className={`min-h-5 text-sm ${state?.error ? "text-red-600" : "text-primary"}`}>
        {state?.error ?? state?.ok}
      </p>
      <button disabled={pending} className="btn-primario h-12">
        {pending ? "Guardando…" : "Crear usuario"}
      </button>
    </form>
  );
}
