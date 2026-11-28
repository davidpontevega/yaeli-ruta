"use client";

import { useEffect } from "react";

/** Registers public/sw.js (offline "Mi ruta de hoy"). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(console.error);
  }, []);
  return null;
}
