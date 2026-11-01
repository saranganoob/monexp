// Daily spends: tea, meals, snacks and other small everyday spends, one record per day.
// Taken off the month's balance unless the person turned that off in Profile (then only for tracking).
// Today (India time) and any earlier day can be filled in (for days you forgot); future days don't exist yet.
import { Router } from 'express';
import { DailySpend, DAILY_SLOTS, dailyDayTotal as dayTotal } from '../models/index.js';
import { badRequest } from '../lib/http.js';
import { toAmount, toText, toYm } from '../lib/validate.js';
import { todayInIndia } from '../lib/ym.js';

const router = Router();
const MAX_OTHERS = 20;

const normDay = (d) => ({
  date: d.date,
  ...Object.fromEntries(DAILY_SLOTS.map((k) => [k, d[k] || 0])),
  others: (d.others || []).map((o) => ({ name: o.name || '', amount: o.amount || 0 })),
  total: dayTotal(d),
});

// GET /api/daily?ym=2026-10 – every logged day of the month, the month's total, and today's date.
router.get('/', async (req, res) => {
  const ym = toYm(req.query.ym, 'ym');
  const today = todayInIndia();
  const days = (await DailySpend.find({ ym, date: { $lte: today } }).sort({ date: 1 }).lean()).map(normDay);
  res.json({ ym, today, days, monthTotal: days.reduce((s, d) => s + d.total, 0) });
});

// PUT /api/daily/2026-10-28 { teaMorning, breakfast, …, others: [{ name, amount }] } – today or an earlier day.
router.put('/:date', async (req, res) => {
  const date = String(req.params.date);
  const today = todayInIndia();
  const real = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== date) {
    throw badRequest('date must be a real day like 2026-10-28.');
  }
  if (date > today) throw badRequest('You can’t add spends for a future day.');

  const b = req.body || {};
  const slots = Object.fromEntries(DAILY_SLOTS.map((k) => [k, b[k] == null || b[k] === '' ? 0 : toAmount(b[k], 'Amount')]));
  const raw = Array.isArray(b.others) ? b.others : [];
  if (raw.length > MAX_OTHERS) throw badRequest(`Keep it to ${MAX_OTHERS} other expenses a day.`);
  const others = raw
    .map((o) => ({ name: toText(o?.name, 'What it was', { max: 60 }), amount: o?.amount == null || o.amount === '' ? 0 : toAmount(o.amount, 'Amount') }))
    .filter((o) => o.name || o.amount); // empty rows aren't kept

  const day = { date, ym: date.slice(0, 7), ...slots, others };
  if (!dayTotal(day) && !others.length) {
    await DailySpend.deleteOne({ date });
    return res.json(normDay(day));
  }
  const saved = await DailySpend.findOneAndUpdate({ date }, { $set: day }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
  res.json(normDay(saved));
});

export default router;
