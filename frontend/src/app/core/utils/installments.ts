// Where an EMI / installment stands in a month – the same rules as the backend
// (backend/src/lib/installments.js). Months are an index: I = year * 12 + monthIndex.
import { Freq } from '../models';

export interface PlanShape { startIdx: number; total: number; freq: Freq; }

export const step = (e: PlanShape) => (e.freq === 'yearly' ? 12 : 1);

/** Ongoing plans (rent, support…) have no end date; for counting they're treated as a very long plan. */
export const ONGOING_TOTAL = 1200;
export const totalOf = (total: number | null | undefined) => total ?? ONGOING_TOTAL;

/** Month index of the last payment. */
export const endIdx = (e: PlanShape) => e.startIdx + (e.total - 1) * step(e);

/** In month I: n = payments so far including this month's (if due); due = a payment falls in I. */
export function instAt(e: PlanShape, I: number): { n: number; due: boolean } {
  if (I < e.startIdx) return { n: 0, due: false };
  const k = Math.floor((I - e.startIdx) / step(e));
  return { n: Math.min(k + 1, e.total), due: (I - e.startIdx) % step(e) === 0 && k < e.total };
}

/** Payments still to make from month I on (this month's counts as left if it's due). */
export function leftFrom(e: PlanShape, I: number): number {
  if (I > endIdx(e)) return 0;
  if (I < e.startIdx) return e.total;
  const { n, due } = instAt(e, I);
  return e.total - n + (due ? 1 : 0);
}

/** Payments already made strictly before month I. */
export const alreadyPaidBefore = (e: PlanShape, I: number) => e.total - leftFrom(e, I);

/** The first month from I on with a payment, or null when the plan is over. */
export function nextDueIdx(e: PlanShape, I: number): number | null {
  if (I > endIdx(e)) return null;
  if (I <= e.startIdx) return e.startIdx;
  const s = step(e);
  return e.startIdx + Math.ceil((I - e.startIdx) / s) * s;
}

/** Number of payments from the first to the last payment month (inclusive). */
export const paymentsBetween = (startIdx: number, lastIdx: number, freq: Freq) =>
  Math.floor((lastIdx - startIdx) / (freq === 'yearly' ? 12 : 1)) + 1;
