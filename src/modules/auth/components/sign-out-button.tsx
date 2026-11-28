"use client";

import { useTransition, type ButtonHTMLAttributes } from "react";
import { clearOfflineData } from "@/lib/offline-store";
import { signOut } from "../actions";

/** "Salir": wipes the route kept on this phone (IndexedDB + SW cache) before closing the session. */
export function SignOutButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [pending, start] = useTransition();
  const out = () =>
    start(async () => {
      try {
        await clearOfflineData();
      } catch (e) {
        // Leaving must still work; the next user's page wipes data that isn't theirs (spec 024, AC7).
        console.error(e);
      }
      await signOut();
    });
  return (
    <button type="button" onClick={out} disabled={pending} {...props}>
      Salir
    </button>
  );
}
