// Customer account rules. Pure.

/**
 * Date of the oldest charge still unpaid, applying payments FIFO to the oldest charges.
 * `movements` in chronological order; amount > 0 is a charge (initial debt, delivery, positive adjustment), < 0 a payment.
 * null = nothing owed.
 */
export function debtSince(movements: { amount: number; date: string }[]): string | null {
  const open: { date: string; left: number }[] = [];
  let credit = 0; // payment not yet matched to a charge (paid before the charge existed)
  for (const m of movements) {
    if (m.amount > 0) {
      const used = Math.min(credit, m.amount);
      credit -= used;
      if (m.amount > used) open.push({ date: m.date, left: m.amount - used });
    } else {
      let pay = -m.amount;
      while (pay > 0 && open.length) {
        const take = Math.min(pay, open[0].left);
        open[0].left -= take;
        pay -= take;
        if (!open[0].left) open.shift();
      }
      credit += pay;
    }
  }
  return open[0]?.date ?? null;
}

/**
 * Account statement for [from, to] (YYYY-MM-DD, both inclusive). `movements` in chronological order.
 * opening + charges − payments + adjustments = closing.
 */
export function buildStatement<M extends { type: string; amount: number; date: string }>(movements: M[], from: string, to: string) {
  let opening = 0;
  let charges = 0;
  let payments = 0;
  let adjustments = 0;
  const rows: (M & { balance: number })[] = [];
  for (const m of movements) {
    if (m.date < from) opening += m.amount;
    else if (m.date <= to) {
      if (m.type === "ABONO") payments -= m.amount;
      else if (m.type === "AJUSTE") adjustments += m.amount;
      else charges += m.amount; // SALDO_INICIAL, CARGO
      rows.push({ ...m, balance: opening + charges - payments + adjustments });
    }
  }
  return { opening, charges, payments, adjustments, closing: opening + charges - payments + adjustments, rows };
}
