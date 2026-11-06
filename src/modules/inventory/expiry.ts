const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in Lima as YYYY-MM-DD. The server runs in UTC, which is already "tomorrow" after 7 pm in Peru. */
export const todayInLima = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/Lima" });

/** Whole days from `today` to `expiresOn` (both YYYY-MM-DD). Negative = already expired. */
export const daysUntil = (expiresOn: string, today: string) => Math.round((Date.parse(expiresOn) - Date.parse(today)) / DAY_MS);

export type ExpiryBucket = "expired" | "30" | "60" | "90";

/** Expiring today counts as "30" (still sellable today). Beyond 90 days → null. */
export function expiryBucket(days: number): ExpiryBucket | null {
  if (days < 0) return "expired";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return null;
}

/** YYYY-MM-DD plus n days. */
export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY_MS).toISOString().slice(0, 10);
