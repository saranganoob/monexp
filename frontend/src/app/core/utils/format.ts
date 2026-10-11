// Pure helpers for months and money. No Angular, no styling.
import { Bill } from '../models';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ₹1,00,000 – Indian digit grouping. */
export const inr = (n: number | null | undefined) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
/** For amount inputs: 61833 → "61,833", 0 → "". */
export const fmtInput = (n: number | null | undefined) => (n ? n.toLocaleString('en-IN') : '');
/** Keeps digits only: "₹61,833" → 61833. */
export const parseNum = (v: string | number | null | undefined) => Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0;

export function ord(d: number) {
  const s = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return d + s;
}

// ---- months, written "2026-10" ----
export const ymYear = (ym: string) => Number(ym.slice(0, 4));
export const ymMonth0 = (ym: string) => Number(ym.slice(5, 7)) - 1;
export const makeYm = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, '0')}`;
export const ymIndex = (ym: string) => ymYear(ym) * 12 + ymMonth0(ym);
export const addMonths = (ym: string, n: number) => { const i = ymIndex(ym) + n; return makeYm(Math.floor(i / 12), i % 12); };
export const ymLabel = (ym: string) => `${FULL_MONTHS[ymMonth0(ym)]} ${ymYear(ym)}`;
export const ymShort = (ym: string) => `${MONTHS[ymMonth0(ym)]} ${ymYear(ym)}`;
export const lastDay = (ym: string) => new Date(ymYear(ym), ymMonth0(ym) + 1, 0).getDate();
export const firstDate = (ym: string) => `${ym}-01`;
export const lastDate = (ym: string) => `${ym}-${String(lastDay(ym)).padStart(2, '0')}`;
/** "2026-10-11" → "11 Oct" */
export const dayMonth = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

export const currentYm = () => { const d = new Date(); return makeYm(d.getFullYear(), d.getMonth()); };
export const todayIso = () => { const d = new Date(); return `${currentYm()}-${String(d.getDate()).padStart(2, '0')}`; };
export const todayLabel = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
/** Default date for a new entry in `ym`: today if it's this month, otherwise the 1st. */
export const defaultDate = (ym: string) => (ym === currentYm() ? todayIso() : firstDate(ym));
/** Years for a year <select>: around today, always including `y`. */
export const yearOptions = (y: number, back = 1, ahead = 1) => {
  const now = new Date().getFullYear();
  const years = new Set([y]);
  for (let i = now - back; i <= now + ahead; i++) years.add(i);
  return [...years].sort();
};

export type DueTone = 'normal' | 'soon' | 'overdue';
export interface DueInfo { label: string; tone: DueTone; }

/** "Due in 3 days · 11th", "Overdue by 2 days" … counted from today in the current month. */
export function dueInfo(b: Bill, ym: string): DueInfo {
  if (!b.dueDay) return { label: b.note || 'No due date set', tone: 'normal' };
  if (b.status !== 'unpaid' || ym !== currentYm()) return { label: 'Due on the ' + ord(b.dueDay), tone: 'normal' };
  const diff = b.dueDay - new Date().getDate();
  if (diff === 0) return { label: 'Due today', tone: 'soon' };
  if (diff > 0) return { label: `Due in ${diff} day${diff === 1 ? '' : 's'} · ${ord(b.dueDay)}`, tone: diff <= 7 ? 'soon' : 'normal' };
  return { label: `Overdue by ${-diff} day${diff === -1 ? '' : 's'}`, tone: 'overdue' };
}
