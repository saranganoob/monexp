// A month is identified by a "ym" string: "2026-10" = October 2026.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const isYm = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function ymToIndex(ym) {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}

export function indexToYm(i) {
  const y = Math.floor(i / 12);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const addMonths = (ym, n) => indexToYm(ymToIndex(ym) + n);

export function ymLabel(ym, { short = false } = {}) {
  const [y, m] = ym.split('-').map(Number);
  return `${(short ? MONTHS : FULL_MONTHS)[m - 1]} ${y}`;
}

export function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function currentYm(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function todayIso(now = new Date()) {
  return `${currentYm(now)}-${String(now.getDate()).padStart(2, '0')}`;
}
