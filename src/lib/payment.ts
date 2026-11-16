/** Payment methods (must match DB enum `medio_pago`; accounts/ledger.ts checks it at compile time) with their labels. */
export const PAYMENT_METHODS = [
  ["EFECTIVO", "Efectivo"],
  ["YAPE", "Yape"],
  ["PLIN", "Plin"],
  ["TRANSFERENCIA", "Transferencia"],
] as const;
export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map(([v]) => v) as unknown as readonly ["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA"];
export const paymentLabel = (m: string) => PAYMENT_METHODS.find(([v]) => v === m)?.[1] ?? m;
