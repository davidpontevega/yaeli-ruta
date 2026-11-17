"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToPurchaseList } from "../actions";

/** "Agregar a la lista" for a low product: drops it into its supplier's draft, with an inline notice. Without supplier, a link to assign one. */
export function AddToListButton({ productId, hasSupplier }: { productId: string; hasSupplier: boolean }) {
  const [state, action, pending] = useActionState(addToPurchaseList, undefined);
  if (!hasSupplier)
    return (
      <Link href={`/productos/${productId}`} className="btn-suave h-9 px-3 text-sm">
        Asignar proveedor
      </Link>
    );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <button disabled={pending} className="btn-suave h-9 px-3 text-sm">
        {pending ? "Agregando…" : "Agregar a la lista"}
      </button>
      {state?.ok && (
        <span role="status" className="text-sm text-emerald-700">
          {state.already ? "Ya estaba en" : "Agregado a"} la lista #{state.number} · {state.supplierName} ·{" "}
          <Link href={`/compras/${state.purchaseId}`} className="font-semibold underline">
            Abrir lista
          </Link>
        </span>
      )}
      {state?.ok === false && (
        <span role="alert" className="text-sm text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
