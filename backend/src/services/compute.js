// Pure money calculations – no database access, so they're easy to test.
// Every total shown in the app (and later given to the AI) comes from here.
//
// Inputs are plain objects with string ids (see normalize.js).

import { CATEGORIES } from '../lib/categories.js';
import { ymToIndex, indexToYm, ymLabel } from '../lib/ym.js';
import { instAt, leftFrom, endIdx } from '../lib/installments.js';

const sum = (list) => list.reduce((s, x) => s + (x.amount || 0), 0);

/** An EMI in the shared installment shape (see lib/installments.js). */
export const emiPlan = (e) => ({ startIdx: ymToIndex(e.startYm), total: e.totalMonths, freq: e.freq || 'monthly' });

// Where a monthly installment plan (Dad, gold chit…) stands. n < 1 = not started yet, n > total = finished.
export function installmentAt(startYm, total, ym) {
  const start = ymToIndex(startYm);
  const n = ymToIndex(ym) - start + 1;
  return { n, total, endYm: indexToYm(start + total - 1), active: n >= 1 && n <= total };
}

export function computeMonth({ ym, month, bills, entries, sudden, cardSpends: spendItems = [], cards, emis, plans, people }) {
  const personName = new Map(people.map((p) => [p.id, p.name]));
  const planById = new Map(plans.map((p) => [p.id, p]));
  const overrides = new Map((month.emiOverrides || []).map((o) => [o.emiId, o]));
  const cardSpends = month.cardSpends || {};

  // ---- EMIs / installments with a payment due this month (yearly ones only in their month) ----
  const I = ymToIndex(ym);
  const activeEmis = emis
    .map((e) => {
      const plan = emiPlan(e);
      const at = instAt(plan, I);
      const o = overrides.get(e.id);
      return {
        id: e.id, cardId: e.cardId, item: e.item, forWho: e.forWho, freq: plan.freq,
        personId: e.personId, personName: personName.get(e.personId) || '',
        monthly: e.monthly,
        amount: o && o.amount != null ? o.amount : e.monthly || 0, // this payment's amount
        n: at.n, total: e.totalMonths, left: leftFrom(plan, I), startYm: e.startYm, endYm: indexToYm(endIdx(plan)), active: at.due,
        received: (o && o.received) || 'pending',
        paid: (o && o.paid) || 'unpaid',
      };
    })
    .filter((e) => e.active);
  const cardEmis = activeEmis.filter((e) => e.cardId);
  const bankEmis = activeEmis.filter((e) => !e.cardId);

  // ---- cards: bill = my spends + my EMIs + friends' EMIs ----
  const cardViews = cards.map((c) => {
    const em = cardEmis.filter((e) => e.cardId === c.id);
    const myEmis = sum(em.filter((e) => e.forWho !== 'friend'));
    const friendEmis = sum(em.filter((e) => e.forWho === 'friend'));
    const spends = cardSpends[c.id] || 0;
    const items = spendItems.filter((s) => s.cardId === c.id);
    const itemised = sum(items);
    return {
      id: c.id, name: c.name, network: c.network, last4: c.last4, closedOn: c.closedOn,
      spends, myEmis, friendEmis, total: spends + myEmis + friendEmis,
      // Itemised purchases, plus whatever part of "my spends" wasn't itemised.
      items, itemised, notItemised: spends - itemised,
      emis: em, billId: null, billStatus: null,
    };
  });
  const cardById = new Map(cardViews.map((c) => [c.id, c]));

  const planAt = (planId) => {
    const p = planById.get(planId);
    return p ? installmentAt(p.startYm, p.totalInstallments, ym) : null;
  };
  const inPlanRange = (x) => !x.inst || (x.inst.n >= 1 && x.inst.n <= x.inst.total);

  // ---- bills ----
  const billViews = bills
    .map((b) => {
      const v = { ...b, kind: 'bill', inst: null };
      const card = b.cardId && cardById.get(b.cardId);
      if (card) {
        v.amount = card.total;
        v.name = `${card.name} credit card`;
        card.billId = b.id;
        card.billStatus = b.status;
      }
      const at = b.planId && planAt(b.planId);
      if (at) v.inst = { n: at.n, total: at.total };
      return v;
    })
    .filter(inPlanRange);

  // EMIs paid from the bank / cash: their own row (paid status is kept per month on the plan).
  const freqLabel = (e) => (e.freq === 'yearly' ? 'Yearly' : 'Monthly');
  const emiBillRows = bankEmis.map((e) => ({
    id: `emi:${e.id}`, kind: 'emi', emiId: e.id, ym,
    name: e.item + (e.forWho === 'friend' ? ` · ${e.personName || 'friend'}` : ''),
    category: 'emi', amount: e.amount, status: e.paid, dueDay: null,
    note: `${freqLabel(e)} · paid from bank / cash · closes ${ymLabel(e.endYm, { short: true })}`,
    cardId: null, planId: null, forWho: e.forWho, inst: { n: e.n, total: e.total, left: e.left }, sortOrder: 0,
  }));

  // ---- people ----
  const withInst = (r) => {
    const at = r.planId && planAt(r.planId);
    return { ...r, inst: at ? { n: at.n, total: at.total } : null, auto: null };
  };
  const payables = entries.filter((r) => r.direction === 'out').map(withInst);
  // "I owe them" is money to pay too: it's listed (and counted) in Need to pay under "Money I owe".
  // The People entry stays the single source of truth – ticking the row marks it paid back.
  const oweRows = payables.filter((r) => r.status !== 'moved').map((r) => ({
    id: `owe:${r.id}`, kind: 'owe', entryId: r.id, ym, name: r.name, category: 'owe', amount: r.amount,
    status: r.status === 'done' ? 'paid' : 'unpaid', dueDay: null, note: r.note || 'You owe this – paid back is tracked in People',
    cardId: null, planId: null, personId: r.personId, inst: null, sortOrder: r.sortOrder,
  }));

  const allBills = billViews.concat(emiBillRows, oweRows);
  const live = allBills.filter((b) => b.status !== 'skipped');
  const paidBills = live.filter((b) => b.status === 'paid');
  const unpaidBills = live.filter((b) => b.status === 'unpaid');

  const friendEmiRows = activeEmis
    .filter((e) => e.forWho === 'friend')
    .map((e) => ({
      id: `emi:${e.id}`, emiId: e.id, direction: 'in', personId: e.personId,
      name: `${e.personName || 'Friend'} · ${e.item} EMI`, amount: e.amount, status: e.received,
      inst: { n: e.n, total: e.total }, auto: e.cardId ? cardById.get(e.cardId)?.name || 'card' : 'bank / cash',
    }));
  const receivables = entries.filter((r) => r.direction === 'in').map(withInst).filter(inPlanRange).concat(friendEmiRows);

  const notMoved = (r) => r.status !== 'moved';
  const pending = (r) => r.status === 'pending';
  const done = (r) => r.status === 'done';

  // ---- totals ----
  const toPay = sum(live);
  // EMIs I pay for friends (on a card or from the bank) aren't my own spending – they pay me back.
  const friendEmi = cardViews.reduce((s, c) => s + c.friendEmis, 0)
    + sum(emiBillRows.filter((b) => b.forWho === 'friend' && b.status !== 'skipped'));
  const ownPay = toPay - friendEmi;
  // Spends paid by card are already inside that card's bill – don't count them twice.
  const suddenTotal = sum(sudden.filter((s) => !s.cardId));
  const balance = month.budget - ownPay - suddenTotal;
  const recvOther = sum(receivables.filter((r) => !r.auto && notMoved(r)));
  const payTotal = sum(payables.filter(notMoved));

  const categories = CATEGORIES.map((c) => ({ ...c, total: sum(live.filter((b) => b.category === c.key)) }));

  return {
    ym,
    budget: month.budget,
    totals: {
      toPay,
      paid: sum(paidBills),
      unpaid: sum(unpaidBills),
      paidCount: paidBills.length,
      unpaidCount: unpaidBills.length,
      skippedCount: allBills.length - live.length,
      paidPct: toPay ? Math.round((sum(paidBills) / toPay) * 100) : 0,
      friendEmi,
      ownPay,
      sudden: suddenTotal,
      balance,
      // What I owe is already inside "to pay" (Money I owe), so it isn't taken off a second time.
      balanceInclPeople: balance + recvOther,
      recvTotal: sum(receivables.filter(notMoved)),
      recvPending: sum(receivables.filter(pending)),
      recvDone: sum(receivables.filter(done)),
      payTotal,
      payPending: sum(payables.filter(pending)),
      payDone: sum(payables.filter(done)),
    },
    categories,
    bills: allBills,
    cards: cardViews,
    receivables,
    payables,
    suddenSpends: sudden,
  };
}

// Every card EMI and plan that hasn't finished by `ym`, closing soonest first.
export function listInstallments({ ym, emis, plans, cards, people }) {
  const cardName = new Map(cards.map((c) => [c.id, c.name]));
  const personName = new Map(people.map((p) => [p.id, p.name]));

  const I = ymToIndex(ym);

  const emiRows = emis
    .map((e) => {
      const friend = e.forWho === 'friend';
      const who = personName.get(e.personId) || 'Friend';
      const plan = emiPlan(e);
      const at = instAt(plan, I);
      const left = leftFrom(plan, I); // payments left, this month's included if it's due
      return {
        id: e.id, type: 'emi', name: e.item + (friend ? ` · ${who}` : ''),
        kind: (friend ? 'For a friend' : 'Mine') + (e.cardId ? ' · card EMI' : ' · bank / cash'),
        source: e.cardId ? `On ${cardName.get(e.cardId) || 'card'}` : 'Paid from bank / cash',
        friend, incoming: false, freq: plan.freq, monthly: e.monthly || 0, startYm: e.startYm, total: e.totalMonths,
        n: I < plan.startIdx ? 0 : at.n, due: at.due, endYm: indexToYm(endIdx(plan)),
        monthsLeft: left, amountLeft: (e.monthly || 0) * left,
      };
    })
    .filter((r) => r.monthsLeft > 0);

  const planRows = plans
    .map((p) => {
      const at = installmentAt(p.startYm, p.totalInstallments, ym);
      const left = p.totalInstallments - Math.max(at.n - 1, 0); // including this month
      return {
        id: p.id, type: 'plan', name: p.name, kind: p.kind, source: p.source,
        friend: false, incoming: p.direction === 'in', freq: 'monthly', monthly: p.monthly || 0, startYm: p.startYm, total: p.totalInstallments,
        n: at.n, due: at.active, endYm: at.endYm, monthsLeft: left, amountLeft: (p.monthly || 0) * left,
      };
    })
    .filter((r) => r.n <= r.total);

  const rows = emiRows.concat(planRows);

  return rows.sort((a, b) => a.endYm.localeCompare(b.endYm));
}

// Year view: budget vs spent per month, plus where the money went.
export function computeYear(year, computedMonths) {
  const byYm = new Map(computedMonths.map((c) => [c.ym, c]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    const c = byYm.get(ym);
    if (!c) return { ym, exists: false };
    return {
      ym, exists: true, budget: c.budget, spent: c.totals.ownPay + c.totals.sudden,
      sudden: c.totals.sudden, categories: c.categories,
    };
  });
  const tracked = months.filter((m) => m.exists);
  const budget = tracked.reduce((s, m) => s + m.budget, 0);
  const spent = tracked.reduce((s, m) => s + m.spent, 0);
  const categories = CATEGORIES.map((c) => ({
    key: c.key, label: c.label,
    total: tracked.reduce((s, m) => s + m.categories.find((x) => x.key === c.key).total, 0),
  }));
  categories.push({ key: 'sudden', label: 'Sudden spends', total: tracked.reduce((s, m) => s + m.sudden, 0) });
  return { year, months, trackedCount: tracked.length, budget, spent, leftOver: budget - spent, categories };
}
