import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { config } from '../config.js';
import { requireAuth, SESSION_COOKIE } from '../middleware/auth.js';
import { HttpError, badRequest, notFound } from '../lib/http.js';
import { toText } from '../lib/validate.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const LONG_SESSION_DAYS = 30;
// Compared against when the user doesn't exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const lastTenDigits = (s) => s.replace(/\D/g, '').slice(-10);
const publicUser = (u) => ({ email: u.email || '', phone: u.phone || '' });

/** Email, or the last 10 digits of a mobile number. Throws if it's neither. */
function readIdentifier(body) {
  const identifier = toText(body?.identifier, 'Email or mobile number', { required: true }).toLowerCase();
  const isEmail = EMAIL_RE.test(identifier);
  const phone = lastTenDigits(identifier);
  if (!isEmail && (/[a-z]/.test(identifier) || !PHONE_RE.test(phone))) throw badRequest('Enter a valid email or a 10-digit mobile number.');
  return isEmail ? { email: identifier } : { phone };
}

function startSession(res, user, remember) {
  const maxAgeMs = remember ? LONG_SESSION_DAYS * 24 * 60 * 60 * 1000 : undefined; // undefined = until the browser closes
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: remember ? `${LONG_SESSION_DAYS}d` : '12h' });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: maxAgeMs });
  res.json(publicUser(user));
}

router.post('/login', async (req, res) => {
  const password = String(req.body?.password || '');
  const remember = req.body?.remember !== false;
  const who = readIdentifier(req.body);
  if (!password) throw badRequest('Enter your password.');

  const user = await User.findOne(who);
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'That email/mobile and password don’t match.');
  startSession(res, user, remember);
});

// ---- OTP sign-in (demo) ----
// No SMS or email is sent yet: when DEV_OTP is set in .env, that fixed code is the OTP.
// A code is only accepted after "Send OTP", within 10 minutes and 5 tries.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_TRIES = 5;
const otpRequests = new Map(); // userId -> { expiresAt, tries }

const maskEmail = (e) => e.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');
const maskPhone = (p) => `•••••• ${p.slice(-4)}`;

router.get('/otp', (_req, res) => {
  res.json({ enabled: Boolean(config.devOtp) });
});

router.post('/otp/request', async (req, res) => {
  if (!config.devOtp) throw badRequest('OTP sign-in isn’t turned on. Sign in with your password.');
  const who = readIdentifier(req.body);
  const user = await User.findOne(who).lean();
  if (!user) throw notFound(who.email ? 'No account uses this email.' : 'No account uses this mobile number.');
  otpRequests.set(String(user._id), { expiresAt: Date.now() + OTP_TTL_MS, tries: 0 });
  res.json({ sentTo: who.email ? maskEmail(who.email) : maskPhone(who.phone), demo: true });
});

router.post('/otp/verify', async (req, res) => {
  if (!config.devOtp) throw badRequest('OTP sign-in isn’t turned on. Sign in with your password.');
  const who = readIdentifier(req.body);
  const otp = String(req.body?.otp ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(otp)) throw badRequest('Enter the 6-digit OTP.');
  const user = await User.findOne(who);
  const pending = user && otpRequests.get(String(user._id));
  if (!pending || pending.expiresAt < Date.now()) {
    if (user) otpRequests.delete(String(user._id));
    throw new HttpError(401, 'That OTP has expired or wasn’t requested. Tap “Send OTP” again.');
  }
  if (otp !== config.devOtp) {
    pending.tries += 1;
    if (pending.tries >= OTP_MAX_TRIES) {
      otpRequests.delete(String(user._id));
      throw new HttpError(401, 'Too many wrong tries. Tap “Send OTP” to get a new one.');
    }
    throw new HttpError(401, 'That OTP isn’t right. Check it and try again.');
  }
  otpRequests.delete(String(user._id));
  startSession(res, user, req.body?.remember !== false);
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) {
    // The session belongs to an account that no longer exists – treat it as signed out.
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
    throw new HttpError(401, 'Please sign in again.');
  }
  res.json(publicUser(user));
});

router.patch('/me', requireAuth, async (req, res) => {
  const update = {};
  if (req.body?.email !== undefined) {
    const email = toText(req.body.email, 'Email').toLowerCase();
    if (email && !EMAIL_RE.test(email)) throw badRequest('Enter a valid email address.');
    update.email = email || undefined;
  }
  if (req.body?.phone !== undefined) {
    const phone = toText(req.body.phone, 'Phone').replace(/\D/g, '');
    if (phone && !PHONE_RE.test(phone)) throw badRequest('Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.');
    update.phone = phone;
  }
  const user = await User.findById(req.userId);
  if (!user) throw notFound('Account not found.');
  user.set(update);
  if (!user.email && !user.phone) throw badRequest('Keep at least an email or a phone number so you can sign in.');
  await user.save();
  res.json(publicUser(user));
});

export default router;
