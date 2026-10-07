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

router.post('/login', async (req, res) => {
  const identifier = toText(req.body?.identifier, 'Email or mobile number', { required: true }).toLowerCase();
  const password = String(req.body?.password || '');
  const remember = req.body?.remember !== false;
  if (!password) throw badRequest('Enter your password.');

  const isEmail = EMAIL_RE.test(identifier);
  const phone = lastTenDigits(identifier);
  if (!isEmail && !PHONE_RE.test(phone)) throw badRequest('Enter a valid email or a 10-digit mobile number.');

  const user = await User.findOne(isEmail ? { email: identifier } : { phone });
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'That email/mobile and password don’t match.');

  const maxAgeMs = remember ? LONG_SESSION_DAYS * 24 * 60 * 60 * 1000 : undefined; // undefined = until the browser closes
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: remember ? `${LONG_SESSION_DAYS}d` : '12h' });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: maxAgeMs });
  res.json(publicUser(user));
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) throw notFound('Account not found.');
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
