// Fills a demo login with 4 months of realistic, made-up data – for showing MonEXP in interviews.
// Running it again resets the demo (handy if visitors changed things).
//
//   npm run seed-demo -- --yes                              – demo@monexp.com, on the database in backend/.env
//   npm run seed-demo -- --user someone@example.com --yes  – another demo login
//
// Live (Atlas): put the Atlas address in front, e.g.
//   MONGODB_URI="mongodb+srv://…" npm run seed-demo -- --yes
//
// Only that login's money data is replaced – never the login itself. Admin logins are refused,
// so the owner's real data can't be wiped by mistake.
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import {
  User, Month, BillItem, Card, CardEmi, Plan, Person, PeopleEntry, SuddenSpend, CardSpend, DailySpend, MONEY_MODELS,
} from '../src/models/index.js';
import { runAsOwner } from '../src/lib/owner.js';
import { addMonths, todayInIndia } from '../src/lib/ym.js';

const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const email = (arg('--user') || 'demo@monexp.com').toLowerCase();
const confirmed = process.argv.includes('--yes');

/** Same numbers every run (a tiny seeded random), so the demo looks the same after a reset. */
let seed = 20261102;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (lo, hi, step = 10) => lo + Math.round((rand() * (hi - lo)) / step) * step;

const where = () => {
  try { return new URL(config.mongoUri.replace(/^mongodb(\+srv)?:/, 'http:')).host; } catch { return 'the database'; }
};

await connectDb(config.mongoUri);
try {
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`No login uses ${email}. Create it first (Admin page, or  npm run create-user).`);
    process.exitCode = 1;
  } else if (user.isAdmin) {
    console.log(`${email} is an admin login – refusing, so real data is never wiped. Use a separate demo login.`);
    process.exitCode = 1;
  } else if (!confirmed) {
    console.log(`This replaces ALL money data of ${email} on ${where()} with demo data.`);
    console.log('Run again with  -- --yes  to go ahead.');
    process.exitCode = 1;
  } else {
    const summary = await runAsOwner(user._id, () => fillDemo());
    // A friendly name and colour for the demo (only if the login doesn't have its own yet).
    if (!user.name) user.name = 'Arjun Kumar';
    if (!user.prefs?.accent) user.set('prefs.accent', '#10B981');
    await user.save();
    console.log(`Demo ready for ${email} on ${where()}:`);
    console.log(`  ${summary}`);
    console.log('Tip: switch AI on for this login on the Admin page to show Ask Kanakku.');
  }
} finally {
  await disconnectDb();
}

async function fillDemo() {
  for (const M of MONEY_MODELS) await M.deleteMany({});

  const today = todayInIndia();
  const now = today.slice(0, 7);
  const yms = [-3, -2, -1, 0].map((n) => addMonths(now, n)); // the last 4 months, this one included
  const first = yms[0];
  const id = () => new mongoose.Types.ObjectId();

  // ---- cards, people, EMIs, installment plans ----
  const hdfc = id(), icici = id();
  await Card.insertMany([
    { _id: hdfc, name: 'HDFC Millennia', last4: '4521', network: 'Visa', sortOrder: 1 },
    { _id: icici, name: 'Amazon Pay ICICI', last4: '7703', network: 'Visa', sortOrder: 2 },
  ]);
  const rahul = id(), priya = id(), karthik = id(), vikram = id();
  await Person.insertMany([
    { _id: rahul, name: 'Rahul', relation: 'Friend' },
    { _id: priya, name: 'Priya', relation: 'Colleague' },
    { _id: karthik, name: 'Karthik', relation: 'Friend' },
    { _id: vikram, name: 'Vikram', relation: 'Roommate' },
  ]);
  const phone = id(), laptop = id(), washer = id();
  await CardEmi.insertMany([
    { _id: phone, card: hdfc, item: 'iPhone 15', forWho: 'me', monthly: 2850, totalMonths: 12, startYm: addMonths(first, -4) },
    { _id: laptop, card: null, item: 'Laptop · Bajaj Finserv', forWho: 'me', monthly: 3200, totalMonths: 24, startYm: addMonths(first, -6) },
    { _id: washer, card: icici, item: 'Washing machine', forWho: 'friend', person: vikram, monthly: 1999, totalMonths: 9, startYm: addMonths(first, -1) },
  ]);
  const dad = id(), chit = id(), bikeLoan = id();
  await Plan.insertMany([
    { _id: dad, name: 'Dad', kind: 'Monthly support', source: 'Sent every month', direction: 'out', category: 'fam', monthly: 5000, totalInstallments: null, startYm: addMonths(first, -12) },
    { _id: chit, name: 'Gold chit', kind: 'Savings (chit)', source: '₹3,000 a month for 11 months', direction: 'out', category: 'inv', monthly: 3000, totalInstallments: 11, startYm: addMonths(first, -3) },
    { _id: bikeLoan, name: 'Rahul · bike loan', kind: 'Paying you back', source: '₹12,000 in 6 parts', direction: 'in', category: 'fam', person: rahul, monthly: 2000, totalInstallments: 6, startYm: addMonths(first, -1) },
  ]);

  // ---- month by month ----
  let bills = 0;
  for (const ym of yms) {
    const isNow = ym === now;
    const st = (paidNow) => (isNow ? (paidNow ? 'paid' : 'unpaid') : 'paid');
    const month = ym.slice(5);
    const date = (d) => `${ym}-${String(Math.min(d, isNow ? Number(today.slice(8)) : 28)).padStart(2, '0')}`;

    await Month.create({
      ym, budget: isNow ? 72000 : 70000, createdHow: 'seed',
      cardSpends: { [String(hdfc)]: pick(7000, 12500), [String(icici)]: pick(2500, 6000) },
      emiOverrides: [
        { emi: laptop, paid: isNow ? 'unpaid' : 'paid' }, // bank EMI: ticked on Need to pay
        { emi: washer, received: isNow ? 'pending' : 'done' }, // Vikram pays back his EMI
      ],
    });

    const rows = [
      { name: 'House rent', category: 'house', amount: 15000, status: 'paid', dueDay: 5 },
      { name: 'Electricity · TNEB', category: 'house', amount: pick(1050, 1650), status: st(false), dueDay: 10 },
      { name: 'Internet · ACT Fibernet', category: 'house', amount: 799, status: st(false), dueDay: 12 },
      { name: 'Netflix', category: 'sub', amount: 199, status: 'paid', dueDay: 8 },
      isNow
        ? { name: 'Spotify', category: 'sub', amount: 0, status: 'skipped', dueDay: 15, note: 'Paused this month' }
        : { name: 'Spotify', category: 'sub', amount: 119, status: 'paid', dueDay: 15 },
      { name: 'Mobile · Jio', category: 'sub', amount: 399, status: st(false), dueDay: 20 },
      { name: 'Gym membership', category: 'fam', amount: 1000, status: 'paid', dueDay: 3 },
      { name: 'SIP · Nifty 50 index fund', category: 'inv', amount: 3000, status: 'paid', dueDay: 7 },
      { name: 'PPF', category: 'inv', amount: 1000, status: st(true), dueDay: 25 },
      { name: 'card bill', category: 'cc', amount: 0, status: st(false), card: hdfc },
      { name: 'card bill', category: 'cc', amount: 0, status: st(false), card: icici },
      { name: 'Dad', category: 'fam', amount: 5000, status: 'paid', plan: dad },
      { name: 'Gold chit', category: 'inv', amount: 3000, status: st(false), plan: chit },
    ];
    await BillItem.insertMany(rows.map((b, i) => ({ ym, sortOrder: i + 1, dueDay: null, ...b })));
    bills += rows.length;

    // Money between people (Rahul's bike-loan parts come from his plan).
    const entries = [
      { direction: 'in', person: rahul, plan: bikeLoan, name: 'Rahul · bike loan', amount: 2000, status: isNow ? 'pending' : 'done' },
    ];
    if (month === yms[0].slice(5)) entries.push({ direction: 'out', person: vikram, name: 'Vikram · Goa trip advance', amount: 2000, status: 'done' });
    if (ym === yms[2]) entries.push({ direction: 'in', person: priya, name: 'Priya · movie tickets', amount: 600, status: 'done' });
    if (isNow) {
      entries.push(
        { direction: 'in', person: rahul, name: 'Rahul · dinner at Barbeque Nation', amount: 1500, status: 'pending' },
        { direction: 'in', person: priya, name: 'Priya · cab share', amount: 800, status: 'pending' },
        { direction: 'out', person: karthik, name: 'Karthik · concert ticket', amount: 600, status: 'pending' },
      );
    }
    await PeopleEntry.insertMany(entries.map((e, i) => ({ ym, sortOrder: i + 1, ...e })));

    // One or two sudden spends a month (one paid by card – already in that card's bill).
    const sudden = [
      [yms[0], 'Bike service', 2200, 'UPI', null, 14],
      [yms[1], 'Birthday gift for Mom', 3500, 'UPI', null, 9],
      [yms[2], 'Festival shopping', 6800, 'HDFC Millennia', hdfc, 20],
      [yms[2], 'Phone screen guard', 499, 'Cash', null, 26],
      [now, 'Doctor visit', 900, 'Cash', null, 1],
    ].filter((s) => s[0] === ym);
    await SuddenSpend.insertMany(sudden.map(([, name, amount, mode, card, d]) => ({ ym, name, amount, mode, card, date: date(d) })));

    if (isNow) {
      await CardSpend.insertMany([
        { ym, card: hdfc, name: 'Amazon · headphones', amount: 2499, date: date(1) },
        { ym, card: hdfc, name: 'Petrol', amount: 1500, date: date(2) },
      ]);
    }
  }

  // ---- daily spends: most days of the last ~7 weeks (a few forgotten days, so the calendar looks real) ----
  const days = [];
  const end = new Date(`${today}T12:00:00Z`);
  for (let back = 48; back >= 0; back--) {
    const d = new Date(end.getTime() - back * 86400000);
    const date = d.toISOString().slice(0, 10);
    if (rand() < 0.12 && back > 0) continue; // forgot to log this day
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const others = [];
    if (rand() < 0.2) others.push({ name: 'Auto', amount: pick(40, 100) });
    if (rand() < 0.15) others.push({ name: 'Water can', amount: 40 });
    if (weekend && rand() < 0.3) others.push({ name: 'Movie snacks', amount: pick(120, 220) });
    days.push({
      date, ym: date.slice(0, 7),
      teaMorning: 15,
      breakfast: weekend ? pick(50, 90) : pick(30, 50),
      lunch: weekend && rand() < 0.4 ? 0 : pick(80, 140),
      snacks: rand() < 0.5 ? pick(20, 40) : 0,
      teaEvening: rand() < 0.8 ? 15 : 0,
      dinner: pick(60, 140),
      others,
    });
  }
  await DailySpend.insertMany(days);

  return `${yms.length} months (${yms[0]} → ${now}), ${bills} bills, 2 cards, 3 EMIs, 3 plans, 4 people, ${days.length} days of daily spends`;
}
