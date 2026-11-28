"use client";

import { useTransition, type ButtonHTMLAttributes, type FormEvent } from "react";
import { askFirst } from "@/components/ui/confirm";
import { clearOfflineData, readOps } from "@/lib/offline-store";
import { signOut } from "../actions";

type QueuedOp = { id: string; userId: string; state: string; at: string };
const pendingOf = (ops: QueuedOp[], userId: string) => ops.filter((o) => o.userId === userId && o.state === "pending");

/**
 * "Salir": wipes the route kept on this phone (IndexedDB + SW cache) before closing the session.
 * With own deliveries not uploaded yet it asks first; another user's pending deliveries are kept for them (spec 025).
 */
export function SignOutButton({ userId, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { userId: string }) {
  const [pending, start] = useTransition();

  const out = () =>
    start(async () => {
      try {
        const keep = (await readOps<QueuedOp>()).filter((o) => o.userId !== userId && o.state === "pending").map((o) => o.id);
        await clearOfflineData(keep);
      } catch (e) {
        // Leaving must still work; the next user's page wipes data that isn't theirs (spec 024, AC7).
        console.error(e);
      }
      await signOut();
    });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    // askFirst re-submits with data-ok once confirmed.
    if (form.dataset.ok) return void (delete form.dataset.ok, out());
    // Read the queue now (not a cached count): a stale or failed read must never skip the warning.
    void readOps<QueuedOp>()
      .then((ops) => pendingOf(ops, userId).length)
      .catch(() => -1)
      .then((n) => {
        if (!n) return out();
        askFirst({
          title: n > 0 ? `Tienes ${n} entrega${n === 1 ? "" : "s"} sin subir` : "No se pudo revisar si hay entregas sin subir",
          text: "Si sales se pierden.",
          yes: "Salir igual",
          tone: "peligro",
        })({ currentTarget: form, preventDefault() {} } as FormEvent<HTMLFormElement>);
      });
  };

  return (
    <form onSubmit={submit} className="contents">
      <button type="submit" disabled={pending} {...props}>
        Salir
      </button>
    </form>
  );
}
