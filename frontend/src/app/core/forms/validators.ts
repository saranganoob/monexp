import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parseNum } from '../utils/format';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

/** Money typed as "61,833" or "₹61833". Whole rupees; `min` defaults to 1 (above ₹0). */
export function rupees(min = 1): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const raw = String(c.value ?? '').trim();
    if (!raw) return min > 0 ? { required: true } : null;
    if (/[^0-9,₹\s]/.test(raw)) return { rupees: true };
    return parseNum(raw) < min ? { min: true } : null;
  };
}

/** Whole number between min and max (empty is allowed unless `required`). */
export function wholeNumber(min: number, max: number): ValidatorFn {
  return (c) => {
    const raw = String(c.value ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= min && n <= max ? null : { range: { min, max } };
  };
}

export const emailOrMobile: ValidatorFn = (c) => {
  const v = String(c.value ?? '').trim();
  if (!v) return { required: true };
  const digits = v.replace(/\D/g, '');
  const isPhone = !/[a-z]/i.test(v) && digits.length >= 10 && MOBILE_RE.test(digits.slice(-10));
  return EMAIL_RE.test(v) || isPhone ? null : { emailOrMobile: true };
};

export const optionalEmail: ValidatorFn = (c) => (!c.value || EMAIL_RE.test(String(c.value).trim()) ? null : { email: true });
export const optionalMobile: ValidatorFn = (c) => (!c.value || MOBILE_RE.test(String(c.value)) ? null : { mobile: true });
export const optionalUpi: ValidatorFn = (c) => (!c.value || /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(String(c.value).trim()) ? null : { upi: true });
/** Text that isn't just spaces. */
export const notBlank: ValidatorFn = (c) => (String(c.value ?? '').trim() ? null : { required: true });

/** Date string (yyyy-mm-dd) between two dates, read when validating. */
export function dateBetween(min: () => string, max: () => string): ValidatorFn {
  return (c) => {
    const v = String(c.value ?? '');
    return v && v >= min() && v <= max() ? null : { dateRange: true };
  };
}

/**
 * The first error message for a form, in field order.
 * messages: { fieldName: { errorKey: 'Message' } }
 */
export function firstError(form: AbstractControl, messages: Record<string, Record<string, string>>): string {
  for (const [field, byKey] of Object.entries(messages)) {
    const ctrl = form.get(field);
    if (!ctrl || ctrl.disabled || !ctrl.errors) continue;
    for (const key of Object.keys(ctrl.errors)) if (byKey[key]) return byKey[key];
  }
  return '';
}
