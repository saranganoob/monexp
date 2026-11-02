import { Month, BillItem, Card, CardEmi, Plan, Person, PeopleEntry, SuddenSpend, CardSpend, DailySpend, User, dailyDayTotal } from '../models/index.js';
import { currentOwner, isUnscoped } from '../lib/owner.js';
import * as N from './normalize.js';
import { computeMonth, installmentAt } from './compute.js';
import { addPlanRow } from './planService.js';
import { ymLabel } from '../lib/ym.js';
import { badRequest, conflict } from '../lib/http.js';

export const byOrder = { sortOrder: 1, createdAt: 1, _id: 1 };
const suddenOrder = { date: -1, createdAt: -1, _id: -1 };

// Cards, EMIs, plans and people – shared by every month.
export async function loadSetup() {
  const [cards, emis, plans, people] = await Promise.all([
    Card.find().sort(byOrder).lean(),
    CardEmi.find().sort({ createdAt: 1, _id: 1 }).lean(),
    Plan.find().sort({ createdAt: 1, _id: 1 }).lean(),
    Person.find().collation({ locale: 'en' }).sort({ name: 1 }).lean(),
  ]);
  return {
    cards: cards.map(N.normCard),
    emis: emis.map(N.normEmi),
    plans: plans.map(N.normPlan),
    people: people.map(N.normPerson),
  };
}

export async function findPrevMonth(ym) {
  return Month.findOne({ ym: { $lt: ym } }).sort({ ym: -1 }).lean();
}

/**
 * What comes off this person's monthly balance (Profile → Preferences):
 * daily spends unless turned off, sudden spends only when turned on.
 */
async function balanceRules() {
  if (isUnscoped()) return { dailyInBudget: true, suddenInBudget: false };
  const me = await User.findById(currentOwner()).select('prefs.dailyInBudget prefs.suddenInBudget').lean();
  return { dailyInBudget: me?.prefs?.dailyInBudget ?? true, suddenInBudget: me?.prefs?.suddenInBudget ?? false };
}

// Computes several months in one go (a fixed number of queries, whatever the number of months).
export async function computeMonths(yms, setup) {
  setup ??= await loadSetup();
  const filter = yms ? { ym: { $in: yms } } : {};
  const [months, bills, entries, sudden, spends, daily, rules] = await Promise.all([
    Month.find(filter).sort({ ym: 1 }).lean(),
    BillItem.find(filter).sort(byOrder).lean(),
    PeopleEntry.find(filter).sort(byOrder).lean(),
    SuddenSpend.find(filter).sort(suddenOrder).lean(),
    CardSpend.find(filter).sort(suddenOrder).lean(),
    DailySpend.find(filter).lean(),
    balanceRules(),
  ]);
  const dailyBy = new Map();
  for (const d of daily) dailyBy.set(d.ym, (dailyBy.get(d.ym) || 0) + dailyDayTotal(d));
  const group = (rows, norm) => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.ym)) map.set(r.ym, []);
      map.get(r.ym).push(norm(r));
    }
    return map;
  };
  const billsBy = group(bills, N.normBill);
  const entriesBy = group(entries, N.normEntry);
  const suddenBy = group(sudden, N.normSudden);
  const spendsBy = group(spends, N.normCardSpend);

  return months.map((m) => {
    const month = N.normMonth(m);
    return {
      createdHow: month.createdHow,
      ...computeMonth({
        ym: m.ym, month, ...setup,
        bills: billsBy.get(m.ym) || [],
        entries: entriesBy.get(m.ym) || [],
        sudden: suddenBy.get(m.ym) || [],
        cardSpends: spendsBy.get(m.ym) || [],
        daily: dailyBy.get(m.ym) || 0,
        ...rules,
      }),
    };
  });
}

// Everything one screen needs for a month. If the month doesn't exist yet, says what it
// could be rolled over from, and which pending people-items could be carried over.
export async function getMonthView(ym) {
  const setup = await loadSetup();
  const [computed] = await computeMonths([ym], setup);
  if (computed) return { exists: true, ...computed };

  const prev = await findPrevMonth(ym);
  const carryCandidates = prev
    ? (await PeopleEntry.find({ ym: prev.ym, status: 'pending', plan: null }).sort(byOrder).lean()).map(N.normEntry)
    : [];
  return { ym, exists: false, rolloverFrom: prev ? prev.ym : null, carryCandidates };
}

// Creates a month: "rollover" copies the latest earlier month, "blank" starts empty.
export async function createMonth(ym, { mode, carryIds = [] }) {
  if (await Month.exists({ ym })) throw conflict(`${ymLabel(ym)} is already set up.`);
  if (mode === 'blank') {
    const month = await Month.create({ ym, budget: 0, createdHow: 'blank' });
    await addCardBills(ym); // cards from Profile belong to every month
    return month;
  }

  const prev = await findPrevMonth(ym);
  if (!prev) throw badRequest('There is no earlier month to roll over from. Start a blank month instead.');

  const [cards, plans, prevBills, prevEntries] = await Promise.all([
    Card.find().lean(),
    Plan.find().lean(),
    BillItem.find({ ym: prev.ym }).sort(byOrder).lean(),
    PeopleEntry.find({ ym: prev.ym }).sort(byOrder).lean(),
  ]);
  const closedCards = new Set(cards.filter((c) => c.closedOn).map((c) => String(c._id)));
  const planById = new Map(plans.map((p) => [String(p._id), p]));
  const planActive = (planId) => {
    const p = planById.get(String(planId));
    return !p || installmentAt(p.startYm, p.totalInstallments, ym).active;
  };

  const bills = prevBills
    .filter((b) => !(b.card && closedCards.has(String(b.card))))
    .filter((b) => !b.plan || planActive(b.plan))
    .map((b) => ({
      ym, name: b.name, category: b.category, amount: b.amount, status: 'unpaid', dueDay: b.dueDay,
      note: b.status === 'skipped' ? 'Set this month’s amount' : b.note, card: b.card, plan: b.plan, sortOrder: b.sortOrder,
    }));

  const carry = new Set(carryIds.map(String));
  const fromLabel = ymLabel(prev.ym, { short: true });
  const carried = prevEntries.filter((r) => !r.plan && r.status === 'pending' && carry.has(String(r._id)));
  const entries = [
    // Installment plans (e.g. Arun paying back the gym money) continue on their own.
    ...prevEntries.filter((r) => r.plan && planActive(r.plan)).map((r) => ({
      ym, direction: r.direction, person: r.person, name: r.name, amount: r.amount, status: 'pending',
      plan: r.plan, note: r.note, sortOrder: r.sortOrder,
    })),
    ...carried.map((r) => ({
      ym, direction: r.direction, person: r.person, name: r.name, amount: r.amount, status: 'pending',
      note: `Carried over from ${fromLabel}`, carriedFrom: prev.ym, origin: r._id, sortOrder: r.sortOrder,
    })),
  ];

  const month = await Month.create({ ym, budget: prev.budget, createdHow: 'rollover' });
  await BillItem.insertMany(bills);
  await PeopleEntry.insertMany(entries);
  if (carried.length) {
    await PeopleEntry.updateMany({ _id: { $in: carried.map((r) => r._id) } }, { status: 'moved', movedTo: ym });
  }
  await addCardBills(ym); // a card added after the last month was set up
  // Plans that start this month (or weren't in the last one) get their row too.
  for (const p of plans) {
    if (!installmentAt(p.startYm, p.totalInstallments, ym).active) continue;
    const Model = p.direction === 'in' ? PeopleEntry : BillItem;
    if (!(await Model.exists({ ym, plan: p._id }))) await addPlanRow(p, ym);
  }
  return month;
}

/** Gives every open card a bill row in `ym` if it doesn't have one yet. */
export async function addCardBills(ym) {
  const [cards, have] = await Promise.all([Card.find({ closedOn: '' }).sort(byOrder).lean(), BillItem.distinct('card', { ym, card: { $ne: null } })]);
  const haveIds = new Set(have.map(String));
  for (const c of cards) {
    if (haveIds.has(String(c._id))) continue;
    await BillItem.create({ ym, name: `${c.name} credit card`, category: 'cc', status: 'unpaid', card: c._id, sortOrder: await nextSortOrder(BillItem, ym) });
  }
}

// Used when something is added to a month that isn't set up yet (the "Add expense" dialog).
export async function ensureMonth(ym) {
  if (await Month.exists({ ym })) return;
  const prev = await findPrevMonth(ym);
  await createMonth(ym, { mode: prev ? 'rollover' : 'blank' });
}

export async function nextSortOrder(Model, ym) {
  const last = await Model.findOne({ ym }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  return (last?.sortOrder ?? 0) + 1;
}
