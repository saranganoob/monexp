// Where an EMI / installment stands in a given month – one set of rules used everywhere
// (Need to pay, card bills, People, Installments, the assistant, reports).
// Months are counted as an index: I = year * 12 + monthIndex (Jan = 0), see ymToIndex.
//
// A plan: { startIdx, total, freq: 'monthly' | 'yearly' }
//   monthly → a payment every month; yearly → only in the same month each year.

export const step = (e) => (e.freq === 'yearly' ? 12 : 1);

/** Month index of the last payment. */
export const endIdx = (e) => e.startIdx + (e.total - 1) * step(e);

/** In month I: n = payments made so far including this month's (if due), due = a payment falls in I. */
export function instAt(e, I) {
  if (I < e.startIdx) return { n: 0, due: false };
  const k = Math.floor((I - e.startIdx) / step(e));
  return { n: Math.min(k + 1, e.total), due: (I - e.startIdx) % step(e) === 0 && k < e.total };
}

/** Payments still to make from month I on (this month's counts as left if it's due). */
export function leftFrom(e, I) {
  if (I > endIdx(e)) return 0;
  if (I < e.startIdx) return e.total;
  const { n, due } = instAt(e, I);
  return e.total - n + (due ? 1 : 0);
}

/** Payments already made strictly before month I. */
export const alreadyPaidBefore = (e, I) => e.total - leftFrom(e, I);

/** The first month from I on that has a payment, or null when the plan is over. */
export function nextDueIdx(e, I) {
  if (I > endIdx(e)) return null;
  if (I <= e.startIdx) return e.startIdx;
  const s = step(e);
  return e.startIdx + Math.ceil((I - e.startIdx) / s) * s;
}
