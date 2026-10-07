import mongoose from 'mongoose';
import { badRequest } from './http.js';
import { isYm } from './ym.js';

const MAX_AMOUNT = 1_000_000_000; // ₹100 crore – a sanity cap, not a business rule

// Accepts 1234, "1234" or "1,234" / "₹1,234". Money is always whole rupees.
export function toAmount(value, field = 'amount') {
  if (typeof value === 'string') value = value.replace(/[₹,\s]/g, '');
  if (value === '' || value === null || value === undefined) throw badRequest(`${field} is required.`);
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_AMOUNT) {
    throw badRequest(`${field} must be a whole number of rupees (0 or more).`);
  }
  return n;
}

export function toText(value, field, { required = false, max = 200 } = {}) {
  const s = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (required && !s) throw badRequest(`${field} is required.`);
  if (s.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return s;
}

export function toYm(value, field = 'month') {
  if (!isYm(value)) throw badRequest(`${field} must look like 2026-10.`);
  return value;
}

export function toId(value, field = 'id') {
  if (!mongoose.isValidObjectId(value)) throw badRequest(`${field} is not a valid id.`);
  return String(value);
}

export function toOptionalId(value, field) {
  return value === undefined || value === null || value === '' ? null : toId(value, field);
}

export function toEnum(value, allowed, field) {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

export function toInt(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  return n;
}

// Copies only the keys present in `body`, running each through its converter.
export function pick(body, converters) {
  const out = {};
  for (const [key, convert] of Object.entries(converters)) {
    if (body[key] !== undefined) out[key] = convert(body[key], key);
  }
  return out;
}
