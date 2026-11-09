// Read-only tools the assistant can call. Every number comes from compute.js –
// the model only explains figures, it never adds up raw records itself.
import { loadSetup, computeMonths } from '../monthService.js';
import { computeYear, listInstallments } from '../compute.js';
import { peopleStats } from '../peopleService.js';
import { CATEGORIES } from '../../lib/categories.js';
import { addMonths, isYm, todayInIndia, ymLabel, ymToIndex } from '../../lib/ym.js';
import { DailySpend, DAILY_SLOTS } from '../../models/index.js';

/** This month, in India. */
const currentYm = () => todayInIndia().slice(0, 7);

const groupLabel = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const sum = (rows, f = (r) => r.amount) => rows.reduce((s, r) => s + (f(r) || 0), 0);
/** "5 of 40", or for an ongoing one (rent, support…) "payment 5, ongoing – no end date". */
const instLabel = (n, total) => (total == null ? `payment ${n}, ongoing – no end date` : `${n} of ${total}`);
const closesLabel = (endYm) => (endYm ? ymLabel(endYm) : 'never – ongoing, no end date');
const SLOT_LABELS = { teaMorning: 'Morning tea', breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', teaEvening: 'Evening tea', dinner: 'Dinner' };
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** A logged day's items as [{ item, amount }] – the fixed slots, then "Others". */
const dayItems = (d) => [
  ...DAILY_SLOTS.filter((k) => d[k]).map((k) => ({ item: SLOT_LABELS[k], amount: d[k] })),
  ...(d.others || []).filter((o) => o.amount || o.name).map((o) => ({ item: o.name || 'Other', amount: o.amount || 0, other: true })),
];

// ---------- tool definitions (sent to Claude) ----------
// eager_input_streaming: inputs stream as generated; we validate them ourselves below.
const ymProp = (what) => ({ type: 'string', description: `${what}, written YYYY-MM, e.g. "2026-10" for October 2026.` });

export const TOOL_DEFINITIONS = [
  {
    name: 'get_month',
    description: 'Everything about one month: budget, totals (to pay, my share, paid, unpaid, sudden spends, balance left, balance incl. people), every bill with its status, each credit card bill split into my spends / my EMIs / friends\' EMIs (with itemised spends), who owes me, who I owe, and sudden spends. Use for any question about a specific month.',
    input_schema: { type: 'object', properties: { ym: ymProp('The month') }, required: ['ym'] },
    eager_input_streaming: true,
  },
  {
    name: 'get_year',
    description: 'A whole year month by month: budget, my share of bills, sudden spends, total spent, left over, card bills, my card EMIs, friends\' card EMIs, installment-plan payments and investments per month, plus year totals and money by group. Use for yearly totals, trends and comparing months.',
    input_schema: { type: 'object', properties: { year: { type: 'integer', description: 'Four-digit year, e.g. 2026.' } }, required: ['year'] },
    eager_input_streaming: true,
  },
  {
    name: 'get_installments',
    description: 'All card EMIs (mine and friends\') and installment plans (money I send monthly, people paying me back) that have not finished by the given month, sorted by closing month, with installment number, months left, amount left and closing month.',
    input_schema: { type: 'object', properties: { ym: ymProp('The month to measure from') }, required: ['ym'] },
    eager_input_streaming: true,
  },
  {
    name: 'get_people',
    description: 'Everyone in the People list with: what they owe me and what I owe them in the given month, their running card EMIs and amount left to recover, and the total received from them so far (all months).',
    input_schema: { type: 'object', properties: { ym: ymProp('The month') }, required: ['ym'] },
    eager_input_streaming: true,
  },
  {
    name: 'get_daily_spends',
    description: 'Daily spends between two dates: tea, breakfast, lunch, snacks, dinner and other small everyday spends the person logs day by day. Returns each logged day with its items and total, totals per item (e.g. all Morning tea + Evening tea), the grand total, days logged and the average per logged day. Unless the person switched it off, each month\'s daily spends come off that month\'s balance (see get_month: dailySpendsTakenOffBalance). Use for any question about food, tea, snacks, meals or "daily spends", e.g. "what did I spend on tea yesterday".',
    input_schema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'First day, YYYY-MM-DD (e.g. "2026-10-28").' },
        to_date: { type: 'string', description: 'Last day, YYYY-MM-DD. Same as from_date for one day.' },
      },
      required: ['from_date', 'to_date'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'find_payments',
    description: 'Search bills, sudden spends, itemised card spends and daily spends (meals, tea, other items) by name (case-insensitive, partial match, e.g. "netflix", "dad", "petrol") across a range of months. Returns each match per month and the totals. Use for "how much did I pay for X".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Part of the name to search for.' },
        from_ym: ymProp('First month of the range (default: January of the current year)'),
        to_ym: ymProp('Last month of the range (default: the current month)'),
      },
      required: ['query'],
    },
    eager_input_streaming: true,
  },
];

// ---------- input validation (inputs aren't validated by the API with eager streaming) ----------
export class ToolInputError extends Error {}

function readYm(input, key, fallback) {
  const v = input?.[key] ?? fallback;
  if (!isYm(v)) throw new ToolInputError(`${key} must look like "2026-10".`);
  return v;
}

// ---------- compact views ----------
export function monthView(c) {
  const cardById = new Map(c.cards.map((x) => [x.id, x]));
  return {
    ym: c.ym,
    month: ymLabel(c.ym),
    budget: c.budget,
    totals: {
      toPayAllBills: c.totals.toPay,
      myShareOfBills: c.totals.ownPay,
      friendsCardEmisInsideCardBills: c.totals.friendEmi,
      paid: c.totals.paid,
      unpaid: c.totals.unpaid,
      billsPaid: c.totals.paidCount,
      billsUnpaid: c.totals.unpaidCount,
      billsSkipped: c.totals.skippedCount,
      suddenSpendsNotOnCards: c.totals.sudden,
      suddenSpendsTakenOffBalance: c.totals.suddenInBudget,
      dailySpends: c.totals.daily,
      dailySpendsTakenOffBalance: c.totals.dailyInBudget,
      balanceLeft: c.totals.balance,
      balanceInclPeople: c.totals.balanceInclPeople,
      peopleOweMePending: c.totals.recvPending,
      peopleOweMeReceived: c.totals.recvDone,
      iOwePending: c.totals.payPending,
    },
    groups: c.categories.map((g) => ({ group: g.label, total: g.total })),
    bills: c.bills.map((b) => ({
      name: b.name, group: groupLabel[b.category], amount: b.status === 'skipped' ? 0 : b.amount, status: b.status,
      ...(b.dueDay ? { dueDay: b.dueDay } : {}),
      ...(b.inst ? { installment: instLabel(b.inst.n, b.inst.total) } : {}),
      ...(b.note ? { note: b.note } : {}),
    })),
    creditCards: c.cards.filter((x) => x.billId || x.emis.length || x.spends).map((x) => ({
      card: x.name, bill: x.total, mySpends: x.spends, myEmis: x.myEmis, friendsEmis: x.friendEmis,
      billStatus: x.billStatus ?? 'no bill this month',
      ...(x.closedOn ? { closedOn: x.closedOn } : {}),
      emis: x.emis.map((e) => ({
        item: e.item, for: e.forWho === 'friend' ? e.personName : 'me', thisMonth: e.amount,
        installment: instLabel(e.n, e.total), closes: closesLabel(e.endYm),
        ...(e.forWho === 'friend' ? { friendPaidThisMonth: e.received === 'done' } : {}),
      })),
      itemisedSpends: x.items.map((i) => ({ name: i.name, amount: i.amount, date: i.date })),
    })),
    // Money can come in bit by bit: receivedSoFar / stillToCome show partly settled entries.
    peopleOweMe: c.receivables.map((r) => ({
      name: r.name, amount: r.amount, status: r.status === 'done' ? 'received' : r.status,
      ...(r.status === 'pending' && r.paid ? { receivedSoFar: r.paid, stillToCome: r.left } : {}),
      ...(r.inst ? { installment: instLabel(r.inst.n, r.inst.total) } : {}),
      ...(r.auto ? { source: `friend's EMI on ${r.auto}` } : {}),
    })),
    iOwe: c.payables.map((r) => ({
      name: r.name, amount: r.amount, status: r.status === 'done' ? 'paid back' : r.status,
      ...(r.status === 'pending' && r.paid ? { paidBackSoFar: r.paid, stillToPay: r.left } : {}),
    })),
    suddenSpends: c.suddenSpends.map((s) => ({
      name: s.name, amount: s.amount, date: s.dateUnknown ? 'unknown' : s.date, paidWith: s.mode,
      ...(s.cardId ? { alreadyInCardBill: true, card: cardById.get(s.cardId)?.name } : {}),
    })),
  };
}

function yearView(year, months) {
  const yearData = computeYear(year, months);
  const byYm = new Map(months.map((m) => [m.ym, m]));
  const rows = yearData.months.filter((m) => m.exists).map((m) => {
    const c = byYm.get(m.ym);
    const live = c.bills.filter((b) => b.status !== 'skipped');
    return {
      month: ymLabel(m.ym), ym: m.ym, budget: c.budget, myShareOfBills: c.totals.ownPay, suddenSpends: c.totals.sudden, dailySpendsInBudget: m.daily,
      spent: m.spent, leftOver: c.budget - m.spent,
      cardBills: sum(c.cards, (x) => (x.billId ? x.total : 0)),
      myCardEmis: sum(c.cards, (x) => x.myEmis), friendsCardEmis: sum(c.cards, (x) => x.friendEmis),
      installmentPlanPayments: sum(live.filter((b) => b.planId)),
      investments: c.categories.find((g) => g.key === 'inv')?.total ?? 0,
      peopleOweMeReceived: c.totals.recvDone,
    };
  });
  return {
    year,
    monthsTracked: yearData.trackedCount,
    monthsNotTracked: yearData.months.filter((m) => !m.exists).map((m) => ymLabel(m.ym)),
    totals: {
      budget: yearData.budget, spent: yearData.spent, leftOver: yearData.leftOver,
      myCardEmis: sum(rows, (r) => r.myCardEmis), friendsCardEmis: sum(rows, (r) => r.friendsCardEmis),
      installmentPlanPayments: sum(rows, (r) => r.installmentPlanPayments), investments: sum(rows, (r) => r.investments),
      suddenSpends: sum(rows, (r) => r.suddenSpends),
    },
    byGroup: yearData.categories.map((g) => ({ group: g.label, total: g.total })),
    months: rows,
  };
}

// ---------- tool runners ----------
const RUNNERS = {
  async get_month(input) {
    const ym = readYm(input, 'ym');
    const [c] = await computeMonths([ym]);
    return c ? monthView(c) : { ym, month: ymLabel(ym), tracked: false, note: 'This month is not set up in MonEXP yet.' };
  },

  async get_year(input) {
    const year = Number(input?.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new ToolInputError('year must be a four-digit year.');
    const yms = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    return yearView(year, await computeMonths(yms));
  },

  async get_installments(input) {
    const ym = readYm(input, 'ym');
    return listInstallments({ ym, ...(await loadSetup()) }).map((i) => ({
      name: i.name, kind: i.kind, perMonth: i.monthly,
      installment: i.n >= 1 ? instLabel(i.n, i.total) : `starts ${ymLabel(i.startYm)}`,
      ...(i.ongoing ? { ongoing: true } : { monthsLeftInclThisMonth: i.monthsLeft, amountLeft: i.amountLeft }), closes: closesLabel(i.endYm),
    }));
  },

  async get_people(input) {
    const ym = readYm(input, 'ym');
    return (await peopleStats(ym)).map((p) => ({
      name: p.name, ...(p.relation ? { relation: p.relation } : {}),
      owesMeThisMonth: p.owed, iOweThisMonth: p.iOwe, runningEmisOnMyCards: p.runningEmis,
      leftToRecoverFromEmis: p.leftToRecover, receivedSoFarAllMonths: p.receivedSoFar,
    }));
  },

  async get_daily_spends(input) {
    const from = input?.from_date, to = input?.to_date;
    if (!isDate(from) || !isDate(to)) throw new ToolInputError('from_date and to_date must look like "2026-10-28".');
    if (from > to) throw new ToolInputError('from_date must not be after to_date.');
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 400) throw new ToolInputError('Ask for at most about a year at a time.');
    const days = await DailySpend.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
    const byItem = {};
    const out = days.map((d) => {
      const items = dayItems(d);
      for (const i of items) {
        const key = i.other ? `Other: ${i.item}` : i.item;
        byItem[key] = (byItem[key] || 0) + i.amount;
      }
      return { date: d.date, items: items.map(({ item, amount }) => ({ item, amount })), total: sum(items) };
    });
    const total = sum(out, (d) => d.total);
    return {
      from, to, today: todayInIndia(), note: 'Daily spends are tracked separately – not part of the budget, bills or balance.',
      days: out, totalsByItem: byItem, total, daysLogged: out.length,
      averagePerLoggedDay: out.length ? Math.round(total / out.length) : 0,
    };
  },

  async find_payments(input) {
    const query = String(input?.query ?? '').trim().toLowerCase();
    if (!query || query.length > 60) throw new ToolInputError('query must be 1–60 characters.');
    const now = currentYm();
    const from = readYm(input, 'from_ym', `${now.slice(0, 4)}-01`);
    const to = readYm(input, 'to_ym', now);
    if (from > to) throw new ToolInputError('from_ym must not be after to_ym.');
    if (ymToIndex(to) - ymToIndex(from) > 60) throw new ToolInputError('Search at most 5 years at a time.');
    const yms = [];
    for (let ym = from; ym <= to; ym = addMonths(ym, 1)) yms.push(ym);

    const matches = [];
    for (const c of await computeMonths(yms)) {
      const hit = (name) => name.toLowerCase().includes(query);
      for (const b of c.bills.filter((x) => hit(x.name))) {
        matches.push({ month: ymLabel(c.ym), type: 'bill', name: b.name, amount: b.status === 'skipped' ? 0 : b.amount, status: b.status });
      }
      for (const s of c.suddenSpends.filter((x) => hit(x.name))) {
        matches.push({ month: ymLabel(c.ym), type: 'sudden spend', name: s.name, amount: s.amount, status: 'paid' });
      }
      for (const card of c.cards) {
        for (const i of card.items.filter((x) => hit(x.name))) {
          matches.push({ month: ymLabel(c.ym), type: `spend on ${card.name}`, name: i.name, amount: i.amount, status: 'on card bill' });
        }
      }
    }
    // Daily spends (tracked separately – listed, but not in totalPaid / totalUnpaid).
    const dailyMatches = [];
    for (const d of await DailySpend.find({ ym: { $gte: from, $lte: to } }).sort({ date: 1 }).lean()) {
      for (const i of dayItems(d).filter((x) => x.item.toLowerCase().includes(query))) {
        dailyMatches.push({ date: d.date, name: i.item, amount: i.amount });
      }
    }
    return {
      query, from: ymLabel(from), to: ymLabel(to), matches,
      totalPaid: sum(matches.filter((m) => m.status === 'paid' || m.status === 'on card bill')),
      totalUnpaid: sum(matches.filter((m) => m.status === 'unpaid')),
      ...(dailyMatches.length ? { dailySpends: dailyMatches, dailySpendsTotal: sum(dailyMatches), dailyNote: 'Daily spends come off the month\'s balance unless the person switched that off.' } : {}),
    };
  },
};

/** Runs a tool. Returns { content, isError } ready for a tool_result block. */
export async function runTool(name, input) {
  const run = RUNNERS[name];
  if (!run) return { content: `Unknown tool: ${name}`, isError: true };
  try {
    return { content: JSON.stringify(await run(input ?? {})), isError: false };
  } catch (err) {
    if (err instanceof ToolInputError) return { content: `Invalid input: ${err.message}`, isError: true };
    throw err;
  }
}

/** Short, human status line shown while a tool runs ("Looking at October 2026…"). */
export function toolStatus(name, input) {
  const m = (k) => (isYm(input?.[k]) ? ymLabel(input[k]) : 'your data');
  switch (name) {
    case 'get_month': return `Looking at ${m('ym')}…`;
    case 'get_year': return `Looking at ${input?.year ?? 'the year'}…`;
    case 'get_installments': return 'Checking your EMIs and plans…';
    case 'get_people': return 'Checking who owes whom…';
    case 'find_payments': return `Searching for “${String(input?.query ?? '').slice(0, 30)}”…`;
    case 'get_daily_spends': return 'Checking your daily spends…';
    default: return 'Looking things up…';
  }
}
