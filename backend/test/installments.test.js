// Monthly / yearly EMIs, bank-or-card, "already running", and "I owe them" in Need to pay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instAt, leftFrom, endIdx, alreadyPaidBefore, nextDueIdx } from '../src/lib/installments.js';
import { computeMonth, listInstallments } from '../src/services/compute.js';
import { ymToIndex, indexToYm } from '../src/lib/ym.js';

const I = ymToIndex;
// Acceptance check 3: yearly insurance, first payment Sep 2024, last Sep 2034 → 11 payments.
const insurance = { startIdx: I('2024-09'), total: 11, freq: 'yearly' };

test('yearly plan: Sep 2024 → Sep 2034 is 11 payments; in Oct 2026, 3 are already paid and the next is Sep 2027', () => {
  assert.equal(indexToYm(endIdx(insurance)), '2034-09');
  assert.deepEqual(instAt(insurance, I('2026-10')), { n: 3, due: false });
  assert.equal(alreadyPaidBefore(insurance, I('2026-10')), 3);
  assert.equal(leftFrom(insurance, I('2026-10')), 8);
  assert.equal(indexToYm(nextDueIdx(insurance, I('2026-10'))), '2027-09');
  assert.deepEqual(instAt(insurance, I('2027-09')), { n: 4, due: true });
  assert.equal(leftFrom(insurance, I('2027-09')), 8); // this month's payment still counts as left
  assert.deepEqual(instAt(insurance, I('2034-10')), { n: 11, due: false });
  assert.equal(leftFrom(insurance, I('2034-10')), 0);
  assert.deepEqual(instAt(insurance, I('2024-08')), { n: 0, due: false });
  assert.equal(leftFrom(insurance, I('2024-08')), 11);
});

test('monthly plan: every month from the start, none after the end', () => {
  const p = { startIdx: I('2026-10'), total: 6, freq: 'monthly' };
  assert.equal(indexToYm(endIdx(p)), '2027-03');
  assert.deepEqual(['2026-09', '2026-10', '2027-03', '2027-04'].map((ym) => instAt(p, I(ym)).due), [false, true, true, false]);
  assert.equal(leftFrom(p, I('2026-12')), 4);
});

// ---- the same rules inside a month's figures ----
const people = [{ id: 'p1', name: 'Mohan' }, { id: 'p2', name: 'Sathish' }];
const cards = [{ id: 'c1', name: 'HDFC', network: 'Visa', last4: '1234', closedOn: '' }];
const emis = [
  { id: 'e1', cardId: null, item: 'Insurance', forWho: 'friend', personId: 'p2', monthly: 12000, freq: 'yearly', totalMonths: 11, startYm: '2024-09' },
  { id: 'e2', cardId: 'c1', item: 'Phone', forWho: 'me', personId: null, monthly: 2000, freq: 'monthly', totalMonths: 6, startYm: '2026-10' },
];
const monthOf = (ym, extra = {}) => computeMonth({
  ym, month: { budget: 50000, cardSpends: {}, emiOverrides: [] },
  bills: [{ id: 'b1', ym, name: 'HDFC credit card', category: 'cc', amount: 0, status: 'unpaid', cardId: 'c1', planId: null }],
  entries: [], sudden: [], cardSpends: [], cards, emis, plans: [], people, ...extra,
});

test('yearly bank/cash friend plan: absent in Oct 2026, a "4 of 11" row in Sep 2027, and the friend owes ₹12,000 that month', () => {
  const oct = monthOf('2026-10');
  assert.ok(!oct.bills.some((b) => b.emiId === 'e1'));
  assert.ok(!oct.receivables.some((r) => r.emiId === 'e1'));

  const sep = monthOf('2027-09');
  const row = sep.bills.find((b) => b.emiId === 'e1');
  assert.deepEqual([row.kind, row.category, row.amount, row.status, row.inst.n, row.inst.total], ['emi', 'emi', 12000, 'unpaid', 4, 11]);
  assert.match(row.note, /Yearly · paid from bank \/ cash · closes Sep 2034/);
  const owed = sep.receivables.find((r) => r.emiId === 'e1');
  assert.deepEqual([owed.amount, owed.personId, owed.auto], [12000, 'p2', 'bank / cash']);
  // I pay it (to pay), but it isn't my own spending (left out of Balance left).
  assert.equal(sep.totals.toPay - sep.totals.ownPay, 12000);
});

test('a 6-month card EMI starting Oct 2026 is in the card bill from Oct 2026 to Mar 2027 only', () => {
  const bill = (ym) => monthOf(ym).cards[0].total;
  assert.deepEqual(['2026-09', '2026-10', '2026-12', '2027-03', '2027-04'].map(bill), [0, 2000, 2000, 2000, 0]);
});

test('"I owe them" appears under Money I owe, counts in the totals once, and moved entries are left out', () => {
  const entries = [
    { id: 'r1', ym: '2026-10', direction: 'out', personId: 'p1', name: 'Mohan', amount: 450, status: 'pending', planId: null },
    { id: 'r2', ym: '2026-10', direction: 'out', personId: 'p1', name: 'Mohan · lunch', amount: 300, status: 'done', planId: null },
    { id: 'r3', ym: '2026-10', direction: 'out', personId: 'p1', name: 'Mohan · old', amount: 999, status: 'moved', planId: null },
    { id: 'r4', ym: '2026-10', direction: 'in', personId: 'p1', name: 'Mohan · trip', amount: 1000, status: 'pending', planId: null },
  ];
  const without = monthOf('2026-10');
  const c = monthOf('2026-10', { entries });
  const owe = c.bills.filter((b) => b.kind === 'owe');
  assert.deepEqual(owe.map((b) => [b.entryId, b.category, b.status, b.amount]), [['r1', 'owe', 'unpaid', 450], ['r2', 'owe', 'paid', 300]]);
  assert.equal(c.totals.toPay - without.totals.toPay, 750);
  assert.equal(c.totals.unpaid - without.totals.unpaid, 450);
  assert.equal(c.totals.paid - without.totals.paid, 300);
  assert.equal(c.totals.balance, without.totals.balance - 750);
  // Balance incl. people only adds what others owe me – what I owe isn't taken off twice.
  assert.equal(c.totals.balanceInclPeople, c.totals.balance + 1000);
});

test('Installments list: yearly plans show payments and money left, finished ones drop off', () => {
  const rows = listInstallments({ ym: '2026-10', emis, plans: [], cards, people });
  const ins = rows.find((r) => r.id === 'e1');
  assert.deepEqual([ins.freq, ins.n, ins.total, ins.monthsLeft, ins.amountLeft, ins.endYm], ['yearly', 3, 11, 8, 96000, '2034-09']);
  assert.equal(listInstallments({ ym: '2034-10', emis, plans: [], cards, people }).find((r) => r.id === 'e1'), undefined);
});
