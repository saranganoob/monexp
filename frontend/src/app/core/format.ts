// Small display helpers shared by every screen.
import { Bill } from './models';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ₹1,00,000 – Indian digit grouping. */
export const inr = (n: number | null | undefined) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
/** For number inputs: 61833 → "61,833", 0 → "". */
export const fmtInput = (n: number | null | undefined) => (n ? n.toLocaleString('en-IN') : '');
/** Keeps digits only: "₹61,833" → 61833. */
export const parseNum = (v: string) => Number(String(v).replace(/[^0-9]/g, '')) || 0;
export const digitsOnly = (v: string) => String(v).replace(/[^0-9]/g, '');

export function ord(d: number) {
  const s = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
  return d + s;
}

export const ymYear = (ym: string) => Number(ym.slice(0, 4));
export const ymMonth0 = (ym: string) => Number(ym.slice(5, 7)) - 1;
export const makeYm = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, '0')}`;
export const ymIndex = (ym: string) => ymYear(ym) * 12 + ymMonth0(ym);
export const addMonths = (ym: string, n: number) => { const i = ymIndex(ym) + n; return makeYm(Math.floor(i / 12), i % 12); };
export const ymLabel = (ym: string) => `${FULL_MONTHS[ymMonth0(ym)]} ${ymYear(ym)}`;
export const ymShort = (ym: string) => `${MONTHS[ymMonth0(ym)]} ${ymYear(ym)}`;

export const currentYm = () => { const d = new Date(); return makeYm(d.getFullYear(), d.getMonth()); };
export const todayIso = () => { const d = new Date(); return `${makeYm(d.getFullYear(), d.getMonth())}-${String(d.getDate()).padStart(2, '0')}`; };
export const todayLabel = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const lastDay = (ym: string) => new Date(ymYear(ym), ymMonth0(ym) + 1, 0).getDate();
/** Default date for a new entry in `ym`: today if it's this month, otherwise the 1st. */
export const defaultDate = (ym: string) => (ym === currentYm() ? todayIso() : `${ym}-01`);

export interface DueInfo { label: string; color: string; overdue: boolean; }

/** "Due in 3 days · 11th", "Overdue by 2 days" … – counted from today for the current month. */
export function dueInfo(b: Bill, ym: string): DueInfo {
  if (!b.dueDay) return { label: b.note || 'No due date set', color: '#4B5563', overdue: false };
  if (b.status !== 'unpaid' || ym !== currentYm()) return { label: 'Due on the ' + ord(b.dueDay), color: '#4B5563', overdue: false };
  const diff = b.dueDay - new Date().getDate();
  if (diff === 0) return { label: 'Due today', color: '#9A3412', overdue: false };
  if (diff > 0) return { label: `Due in ${diff} day${diff === 1 ? '' : 's'} · ${ord(b.dueDay)}`, color: diff <= 7 ? '#9A3412' : '#4B5563', overdue: false };
  return { label: `Overdue by ${-diff} day${diff === -1 ? '' : 's'}`, color: '#A3201A', overdue: true };
}

export const STAT = {
  paid: { label: 'Paid', bg: '#E3F4EC', fg: '#0B6B4B' },
  unpaid: { label: 'Unpaid', bg: '#FDF1DC', fg: '#7A4100' },
  overdue: { label: 'Overdue', bg: '#FDE8E6', fg: '#A3201A' },
  skipped: { label: 'Skipped', bg: '#EEF0F3', fg: '#4B5563' },
};
export type Stat = (typeof STAT)[keyof typeof STAT];
export const chipStyle = (s: Stat) =>
  `font-size: 12px; font-weight: 700; border-radius: 999px; padding: 4px 10px; white-space: nowrap; background: ${s.bg}; color: ${s.fg}`;

/** Pill toggle buttons (filters, tabs). */
export const pillStyle = (on: boolean) =>
  `font: inherit; font-size: 14px; font-weight: 600; min-height: 40px; padding: 0 14px; border-radius: 999px; cursor: pointer; border: 1px solid ${on ? '#1D4ED8' : '#D5DAE1'}; background: ${on ? '#1D4ED8' : '#fff'}; color: ${on ? '#fff' : '#374151'}`;
/** Dark segmented buttons (People tabs, Me / A friend). */
export const segStyle = (on: boolean) =>
  `font: inherit; font-size: 14px; font-weight: 700; min-height: 44px; padding: 0 18px; border-radius: 10px; cursor: pointer; border: 1px solid ${on ? '#111827' : '#D5DAE1'}; background: ${on ? '#111827' : '#fff'}; color: ${on ? '#fff' : '#374151'}`;

/** Reads the value of an input/select from a DOM event. */
export const val = (e: Event) => (e.target as HTMLInputElement).value;
export const checked = (e: Event) => (e.target as HTMLInputElement).checked;
