// Admin page: manage logins (list, add, reset password, switch AI on/off, delete). Only for accounts with isAdmin.
// Deliberately shows nothing of anyone's money data.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { MONEY_MODELS, User, canUseAi } from '../models/index.js';
import { runAsOwner } from '../lib/owner.js';
import { config } from '../config.js';
import { disconnectUser, isOnline } from '../services/live.js';
import { HttpError, badRequest, conflict, notFound } from '../lib/http.js';
import { toId, toText } from '../lib/validate.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const MIN_PASSWORD = 8;

router.use(async (req, _res, next) => {
  const me = await User.findById(req.userId).select('isAdmin').lean();
  if (!me?.isAdmin) throw new HttpError(403, 'Only the admin can open this page.');
  next();
});

const listUser = (u) => ({
  id: String(u._id), name: u.name || '', email: u.email || '', phone: u.phone || '', isAdmin: Boolean(u.isAdmin), aiAllowed: canUseAi(u),
  createdAt: u.createdAt, lastSignInAt: u.lastSignInAt ?? null, online: isOnline(u._id),
});

function readPassword(value) {
  const password = String(value ?? '');
  if (password.length < MIN_PASSWORD) throw badRequest(`The password needs at least ${MIN_PASSWORD} characters.`);
  return password;
}

router.get('/users', async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1, _id: 1 }).lean();
  res.json({ users: users.map(listUser), maxUsers: config.maxUsers });
});

router.post('/users', async (req, res) => {
  const email = toText(req.body?.email, 'Email').toLowerCase();
  const phone = toText(req.body?.phone, 'Mobile number').replace(/\D/g, '').slice(-10);
  if (!email && !phone) throw badRequest('Give an email or a mobile number to sign in with.');
  if (email && !EMAIL_RE.test(email)) throw badRequest('Enter a valid email address.');
  if (phone && !PHONE_RE.test(phone)) throw badRequest('Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.');
  const password = readPassword(req.body?.password);
  if ((await User.countDocuments()) >= config.maxUsers) {
    throw conflict(`You've reached ${config.maxUsers} logins – the most allowed. Raise MAX_USERS to add more.`);
  }
  if (email && (await User.exists({ email }))) throw conflict('An account already uses this email.');
  if (phone && (await User.exists({ phone }))) throw conflict('An account already uses this mobile number.');
  const user = await User.create({ email: email || undefined, phone, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json(listUser(user));
});

router.post('/users/:id/password', async (req, res) => {
  const password = readPassword(req.body?.password);
  const user = await User.findById(toId(req.params.id));
  if (!user) throw notFound('Account not found.');
  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();
  res.json({ ok: true });
});

// Switch Ask AI + the AI summary on or off for one login. The admin always keeps it.
router.patch('/users/:id/ai', async (req, res) => {
  if (typeof req.body?.allowed !== 'boolean') throw badRequest('Say whether AI is allowed (true or false).');
  const user = await User.findById(toId(req.params.id));
  if (!user) throw notFound('Account not found.');
  if (user.isAdmin) throw badRequest('The admin always has AI.');
  user.aiAllowed = req.body.allowed;
  await user.save();
  res.json(listUser(user));
});

// Delete a login and everything in it (bills, cards, EMIs, people…). Can't be undone; the admin can't be deleted.
router.delete('/users/:id', async (req, res) => {
  const user = await User.findById(toId(req.params.id));
  if (!user) throw notFound('Account not found.');
  if (user.isAdmin) throw badRequest('The admin login can’t be deleted.');
  await runAsOwner(user._id, () => Promise.all(MONEY_MODELS.map((M) => M.deleteMany({}))));
  await user.deleteOne();
  disconnectUser(user._id);
  res.json({ ok: true });
});

export default router;
