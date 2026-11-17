// Sales coverage. Pure. Quantities in base units; `sold` = units sold in the last SALES_WINDOW_DAYS.

export const SALES_WINDOW_DAYS = 28;
export const LOW_COVERAGE_DAYS = 7;
export const TARGET_COVERAGE_DAYS = 14;

/** Average units sold per week; null without sales. */
export const weeklySales = (sold: number) => (sold > 0 ? Math.round((sold * 7) / SALES_WINDOW_DAYS) : null);

/** Days the current stock lasts at the recent pace; null without sales. */
export const coverageDays = (total: number, sold: number) => (sold > 0 ? Math.floor((Math.max(0, total) * SALES_WINDOW_DAYS) / sold) : null);

/** Stock (base units) that covers TARGET_COVERAGE_DAYS; 0 without sales. */
export const targetStock = (sold: number) => (sold > 0 ? Math.ceil((sold * TARGET_COVERAGE_DAYS) / SALES_WINDOW_DAYS) : 0);

/** Has sales and lasts less than LOW_COVERAGE_DAYS. */
export function isLowCoverage(total: number, sold: number) {
  const days = coverageDays(total, sold);
  return days !== null && days < LOW_COVERAGE_DAYS;
}
