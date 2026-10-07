import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMonth, computeYear, installmentAt, listInstallments } from '../src/services/compute.js';
import { plainSetup, plainMonth, months } from '../scripts/seed-data.js';

const setup = plainSetup();
const run = (ym) => computeMonth({ ...plainMonth(ym), ...setup });

// "TOTAL NEED TO PAY" from each tab of sample-data.xlsx (my own share, without friends' card EMIs).
// May is ₹5,000 more than the sheet: the owner chose to count the Kodai trip (PLAN.md #9).
const SHEET_TOTALS = {
  '2026-01': 103780, '2026-02': 55423, '2026-03': 60491, '2026-04': 75683, '2026-05': 61926 + 5000,
  '2026-06': 62293, '2026-07': 73203, '2026-08': 61833, '2026-09': 45289, '2026-10': 55466,
};

for (const [ym, expected] of Object.entries(SHEET_TOTALS)) {
  test(`${ym}: my share of bills matches the sheet`, () => {
    assert.equal(run(ym).totals.ownPay, expected);
  });
}

test('October: balances match the sheet', () => {
  const c = run('2026-10');
  assert.equal(c.totals.toPay, 55466);
  assert.equal(c.totals.balance, 10534); // sheet: BALANCE AFTER TOTAL SPENDS
  assert.equal(c.totals.balanceInclPeople, 16053); // sheet: … + TOTAL RECEIVABLES
  assert.equal(c.totals.unpaid, 1018);
  assert.equal(c.totals.unpaidCount, 3);
  assert.equal(c.totals.skippedCount, 1);
  assert.equal(c.totals.recvPending, 2700);
});

test('January: friends’ card EMIs are in the card bill but not in my share', () => {
  const c = run('2026-01');
  const axis = c.cards.find((x) => x.id === 'c1');
  assert.deepEqual([axis.spends, axis.myEmis, axis.friendEmis, axis.total], [3660, 0, 1255, 4915]);
  assert.equal(c.cards.find((x) => x.id === 'c2').total, 11062);
  assert.equal(c.totals.toPay, 116097); // sheet: PAID SPENDS
  assert.equal(c.totals.friendEmi, 12317); // sheet: TOTAL RECEIVABLES (EMIs)
  // Sudden spends not paid by card come out of the balance.
  assert.equal(c.totals.balance, 66000 - 103780 - 50085);
  // Friend EMIs show up as money owed to me, already received.
  const auto = c.receivables.filter((r) => r.auto);
  assert.deepEqual(auto.map((r) => [r.amount, r.status, r.inst.n]), [[1255, 'done', 4], [11062, 'done', 6]]);
});

test('February: a one-month EMI amount override is used', () => {
  const axis = run('2026-02').cards.find((x) => x.id === 'c1');
  assert.equal(axis.friendEmis, 1673);
  assert.equal(axis.total, 3600 + 1673);
});

test('Sudden spends paid by card are not deducted twice', () => {
  const c = run('2026-06');
  assert.equal(c.suddenSpends.length, 1);
  assert.equal(c.totals.sudden, 0);
  assert.equal(c.totals.balance, 66000 - 62293);
});

test('Installment counters come from the start month', () => {
  const oct = run('2026-10');
  assert.deepEqual(oct.bills.find((b) => b.name === 'Dad').inst, { n: 34, total: 40 });
  assert.deepEqual(oct.receivables.find((r) => r.planId === 'p3').inst, { n: 5, total: 7 });
  // Gold chit finished in June, so July's bill list doesn't show it.
  assert.ok(run('2026-06').bills.some((b) => b.name === 'Gold chit'));
  assert.deepEqual(installmentAt('2025-08', 11, '2026-07'), { n: 12, total: 11, endYm: '2026-06', active: false });
});

test('Skipped bills don’t count and card bills are named after the card', () => {
  const c = run('2026-05');
  assert.equal(c.categories.find((x) => x.key === 'inv').total, 9000); // only the gold chit
  assert.equal(c.totals.skippedCount, 5);
  assert.ok(c.bills.some((b) => b.name === 'HDFC Swiggy credit card'));
});

test('Installments list is sorted by closing month and drops finished ones', () => {
  const rows = listInstallments({ ym: '2026-10', ...setup });
  assert.deepEqual(rows.map((r) => r.name), ['Madhan · gym', 'Dad']);
  const dad = rows.find((r) => r.name === 'Dad');
  assert.deepEqual([dad.n, dad.monthsLeft, dad.amountLeft, dad.endYm], [34, 7, 70000, '2027-04']);
});

test('Year view adds up tracked months only', () => {
  const computed = months.map((m) => run(m.ym));
  const y = computeYear(2026, computed);
  assert.equal(y.trackedCount, 10);
  assert.equal(y.months[10].exists, false);
  assert.equal(y.budget, 66000 * 9 + 65000);
  const spent = computed.reduce((s, c) => s + c.totals.ownPay + c.totals.sudden, 0);
  assert.equal(y.spent, spent);
  assert.equal(y.leftOver, y.budget - spent);
  assert.equal(y.categories.at(-1).key, 'sudden');
});
