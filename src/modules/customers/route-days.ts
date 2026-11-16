// Visit days of a route as ISO weekdays (1 = Monday … 7 = Sunday). Pure.
export const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const formatDays = (days: number[]) =>
  [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d - 1])
    .join(" · ");

/** ISO weekday of a YYYY-MM-DD date. */
const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

/** First visit day strictly after `from` (YYYY-MM-DD). Orders taken today are delivered on the next visit. */
export function nextVisitDate(days: number[], from: string): string {
  const base = Date.parse(`${from}T00:00:00Z`);
  for (let n = 1; n <= 7; n++) {
    const d = new Date(base + n * 86_400_000).toISOString().slice(0, 10);
    if (days.includes(isoWeekday(d))) return d;
  }
  return from; // no days: never happens (a route needs at least one)
}
