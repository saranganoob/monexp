// Pure money calculations – no database access, so they're easy to test.
// Every total shown in the app (and later given to the AI) comes from here.
// Mirrors compute() in design/web-app/Main.dc.html.
//
// Inputs are plain objects with string ids (see normalize.js).

import { CATEGORIES } from '../lib/categories.js';
import { ymToIndex, indexToYm } from '../lib/ym.js';

const sum = (list) => list.reduce((s, x) => s + (x.amount || 0), 0);

// Where a plan/EMI stands in a given month. n < 1 = not started yet, n > total = finished.
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

  // ---- card EMIs running this month ----
  const activeEmis = emis
    .map((e) => {
      const at = installmentAt(e.startYm, e.totalMonths, ym);
      const o = overrides.get(e.id);
      return {
        id: e.id, cardId: e.cardId, item: e.item, forWho: e.forWho,
        personId: e.personId, personName: personName.get(e.personId) || '',
        monthly: e.monthly,
        amount: o && o.amount != null ? o.amount : e.monthly || 0, // this month's amount
        n: at.n, total: e.totalMonths, startYm: e.startYm, endYm: at.endYm, active: at.active,
        received: (o && o.received) || 'pending',
      };
    })
    .filter((e) => e.active);

  // ---- cards: bill = my spends + my EMIs + friends' EMIs ----
  const cardViews = cards.map((c) => {
    const em = activeEmis.filter((e) => e.cardId === c.id);
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
      const v = { ...b, inst: null };
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

  const live = billViews.filter((b) => b.status !== 'skipped');
  const paidBills = live.filter((b) => b.status === 'paid');
  const unpaidBills = live.filter((b) => b.status === 'unpaid');

  // ---- people ----
  const friendEmiRows = activeEmis
    .filter((e) => e.forWho === 'friend')
    .map((e) => ({
      id: `emi:${e.id}`, emiId: e.id, direction: 'in', personId: e.personId,
      name: `${e.personName || 'Friend'} · ${e.item} EMI`, amount: e.amount, status: e.received,
      inst: { n: e.n, total: e.total }, auto: cardById.get(e.cardId)?.name || 'card',
    }));

  const withInst = (r) => {
    const at = r.planId && planAt(r.planId);
    return { ...r, inst: at ? { n: at.n, total: at.total } : null, auto: null };
  };
  const receivables = entries.filter((r) => r.direction === 'in').map(withInst).filter(inPlanRange).concat(friendEmiRows);
  const payables = entries.filter((r) => r.direction === 'out').map(withInst);

  const notMoved = (r) => r.status !== 'moved';
  const pending = (r) => r.status === 'pending';
  const done = (r) => r.status === 'done';

  // ---- totals ----
  const toPay = sum(live);
  const friendEmi = cardViews.reduce((s, c) => s + c.friendEmis, 0);
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
      skippedCount: billViews.length - live.length,
      paidPct: toPay ? Math.round((sum(paidBills) / toPay) * 100) : 0,
      friendEmi,
      ownPay,
      sudden: suddenTotal,
      balance,
      balanceInclPeople: balance + recvOther - payTotal,
      recvTotal: sum(receivables.filter(notMoved)),
      recvPending: sum(receivables.filter(pending)),
      recvDone: sum(receivables.filter(done)),
      payTotal,
      payPending: sum(payables.filter(pending)),
      payDone: sum(payables.filter(done)),
    },
    categories,
    bills: billViews,
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

  const rows = emis
    .map((e) => {
      const friend = e.forWho === 'friend';
      const who = personName.get(e.personId) || 'Friend';
      return {
        id: e.id, type: 'emi', name: e.item + (friend ? ` · ${who}` : ''),
        kind: friend ? 'Friend’s card EMI' : 'My card EMI', source: `On ${cardName.get(e.cardId) || 'card'}`,
        friend, incoming: false, monthly: e.monthly || 0, startYm: e.startYm, total: e.totalMonths,
      };
    })
    .concat(plans.map((p) => ({
      id: p.id, type: 'plan', name: p.name, kind: p.kind, source: p.source,
      friend: false, incoming: p.direction === 'in', monthly: p.monthly || 0, startYm: p.startYm, total: p.totalInstallments,
    })))
    .map((r) => {
      const at = installmentAt(r.startYm, r.total, ym);
      const monthsLeft = r.total - Math.max(at.n - 1, 0); // including this month
      return { ...r, n: at.n, endYm: at.endYm, monthsLeft, amountLeft: r.monthly * monthsLeft };
    })
    .filter((r) => r.n <= r.total);

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
