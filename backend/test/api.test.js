// End-to-end API tests against a separate "monexp_test" database (your real data is never touched).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';

process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123';
const { config } = await import('../src/config.js');
config.jwtSecret = process.env.JWT_SECRET;
config.loginRateLimit = 1000; // these tests sign in many times; the limit itself is tested in web.test.js
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');
const { seedSampleData } = await import('../scripts/seed-lib.js');

const TEST_DB = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/monexp_test';
const app = createApp();
const agent = request.agent(app); // keeps the login cookie between requests
const LOGIN = { identifier: 'test@example.com', password: 'test-password-1' };

before(async () => {
  await mongoose.connect(TEST_DB);
  assert.match(mongoose.connection.name, /_test$/, 'refusing to run API tests against a non-test database');
  await mongoose.connection.dropDatabase();
  const user = await User.create({ email: LOGIN.identifier, phone: '9876543210', passwordHash: await bcrypt.hash(LOGIN.password, 4) });
  await seedSampleData(user._id);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('API needs a login', async () => {
  const res = await request(app).get('/api/months/2026-10');
  assert.equal(res.status, 401);
});

test('wrong password is rejected, right one signs in', async () => {
  assert.equal((await request(app).post('/api/auth/login').send({ ...LOGIN, password: 'nope-nope' })).status, 401);
  const res = await agent.post('/api/auth/login').send(LOGIN);
  assert.equal(res.status, 200);
  assert.match(res.headers['set-cookie'][0], /monexp_session=.*HttpOnly/);
  assert.equal((await agent.get('/api/auth/me')).body.email, LOGIN.identifier);
  // Mobile number works too.
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: '+91 98765 43210', password: LOGIN.password })).status, 200);
});

test('OTP sign-in: off unless DEV_OTP is set, then needs “Send OTP” first and the right code', async () => {
  const saved = config.devOtp;
  try {
    config.devOtp = '';
    assert.equal((await request(app).get('/api/auth/otp')).body.enabled, false);
    assert.equal((await request(app).post('/api/auth/otp/request').send({ identifier: LOGIN.identifier })).status, 400);

    config.devOtp = '123456';
    const otpAgent = request.agent(app);
    // Verifying before asking for an OTP doesn't work.
    assert.equal((await otpAgent.post('/api/auth/otp/verify').send({ identifier: LOGIN.identifier, otp: '123456' })).status, 401);
    // Unknown accounts and bad input are refused.
    assert.equal((await otpAgent.post('/api/auth/otp/request').send({ identifier: 'nobody@example.com' })).status, 404);
    assert.equal((await otpAgent.post('/api/auth/otp/request').send({ identifier: 'not-an-email' })).status, 400);

    // By email
    const sent = await otpAgent.post('/api/auth/otp/request').send({ identifier: LOGIN.identifier });
    assert.deepEqual(sent.body, { sentTo: 't•••@example.com', demo: true });
    assert.equal((await otpAgent.post('/api/auth/otp/verify').send({ identifier: LOGIN.identifier, otp: '111111' })).status, 401);
    const ok = await otpAgent.post('/api/auth/otp/verify').send({ identifier: LOGIN.identifier, otp: '123456' });
    assert.equal(ok.status, 200);
    assert.equal((await otpAgent.get('/api/auth/me')).body.email, LOGIN.identifier);
    // The same OTP can't be used twice.
    assert.equal((await request(app).post('/api/auth/otp/verify').send({ identifier: LOGIN.identifier, otp: '123456' })).status, 401);

    // By mobile number, and too many wrong tries cancel the OTP.
    assert.equal((await request(app).post('/api/auth/otp/request').send({ identifier: '9876543210' })).body.sentTo, '•••••• 3210');
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/otp/verify').send({ identifier: '9876543210', otp: '000000' });
    assert.equal((await request(app).post('/api/auth/otp/verify').send({ identifier: '9876543210', otp: '123456' })).status, 401);
  } finally {
    config.devOtp = saved;
  }
});

test('month view has the calculated totals', async () => {
  const res = await agent.get('/api/months/2026-10');
  assert.equal(res.status, 200);
  assert.equal(res.body.exists, true);
  assert.equal(res.body.totals.balance, 10534);
  assert.equal(res.body.totals.balanceInclPeople, 16053);
});

test('mark a bill paid, then undo', async () => {
  const before = (await agent.get('/api/months/2026-10')).body;
  const netflix = before.bills.find((b) => b.name === 'Netflix');
  const res = await agent.patch(`/api/bills/${netflix.id}`).send({ status: 'paid' });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Netflix marked paid');
  assert.equal((await agent.get('/api/months/2026-10')).body.totals.unpaidCount, 2);

  assert.equal((await agent.post(`/api/undo/${res.body.undoToken}`)).status, 200);
  const after2 = (await agent.get('/api/months/2026-10')).body;
  assert.equal(after2.totals.unpaidCount, 3);
  assert.equal(after2.bills.find((b) => b.name === 'Netflix').id, netflix.id);
});

test('edit a card bill total stores my spends', async () => {
  const card = (await agent.get('/api/cards')).body.find((c) => c.name === 'HDFC Swiggy');
  assert.equal((await agent.put(`/api/months/2026-10/cards/${card.id}/bill`).send({ total: '3,000' })).status, 200);
  const view = (await agent.get('/api/months/2026-10')).body;
  assert.equal(view.cards.find((c) => c.id === card.id).total, 3000);
  assert.equal(view.totals.toPay, 55466 - 2474 + 3000);
});

test('add a new spend on top of a card’s existing spends', async () => {
  const card = (await agent.get('/api/cards')).body.find((c) => c.name === 'HDFC Swiggy');
  const before = (await agent.get('/api/months/2026-10')).body.cards.find((c) => c.id === card.id).spends;
  const res = await agent.put(`/api/months/2026-10/cards/${card.id}/bill`).send({ add: '321' });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, `₹321 added to HDFC Swiggy spends · now ₹${(before + 321).toLocaleString('en-IN')}`);
  assert.equal((await agent.get('/api/months/2026-10')).body.cards.find((c) => c.id === card.id).spends, before + 321);
  assert.equal((await agent.put(`/api/months/2026-10/cards/${card.id}/bill`).send({ add: 0 })).status, 400);
  await agent.post(`/api/undo/${res.body.undoToken}`);
  assert.equal((await agent.get('/api/months/2026-10')).body.cards.find((c) => c.id === card.id).spends, before);
});

test('money must be whole rupees', async () => {
  for (const amount of [-5, 12.5, 'abc']) {
    const res = await agent.post('/api/months/2026-10/bills').send({ name: 'Test', category: 'fam', amount });
    assert.equal(res.status, 400, `amount ${amount} should be rejected`);
  }
});

test('November is empty; roll over copies bills and carries chosen people items', async () => {
  const empty = (await agent.get('/api/months/2026-11')).body;
  assert.equal(empty.exists, false);
  assert.equal(empty.rolloverFrom, '2026-10');
  const mohan = empty.carryCandidates.find((r) => r.name.startsWith('Mohan'));
  assert.ok(mohan);
  assert.ok(!empty.carryCandidates.some((r) => r.planId), 'plan entries carry on their own');

  const res = await agent.post('/api/months/2026-11').send({ mode: 'rollover', carryIds: [mohan.id] });
  assert.equal(res.status, 201);
  const nov = res.body.month;
  assert.equal(nov.budget, 66000);
  assert.ok(nov.bills.every((b) => b.status === 'unpaid'));
  assert.ok(!nov.bills.some((b) => b.name.startsWith('Super money')), 'closed card dropped');
  assert.deepEqual(nov.bills.find((b) => b.name === 'Dad').inst, { n: 35, total: 40, ongoing: false });
  assert.deepEqual(nov.receivables.map((r) => r.name).sort(), ['Madhan · gym (₹3,500 total)', 'Mohan · trip advance']);

  // The original is marked as moved in October.
  const oct = (await agent.get('/api/months/2026-10')).body;
  assert.equal(oct.receivables.find((r) => r.id === mohan.id).status, 'moved');

  // Deleting the carried copy puts October's back to pending.
  const copy = nov.receivables.find((r) => r.name.startsWith('Mohan'));
  assert.equal((await agent.delete(`/api/people-entries/${copy.id}`)).status, 200);
  assert.equal((await agent.get('/api/months/2026-10')).body.receivables.find((r) => r.id === mohan.id).status, 'pending');
});

test('adding to a month that does not exist sets it up first', async () => {
  const res = await agent.post('/api/months/2026-12/sudden').send({ name: 'Phone repair', amount: 1500, mode: 'Cash', date: '2026-12-03' });
  assert.equal(res.status, 201);
  const dec = (await agent.get('/api/months/2026-12')).body;
  assert.equal(dec.exists, true);
  assert.equal(dec.totals.sudden, 1500);
  const bad = await agent.post('/api/months/2026-12/sudden').send({ name: 'x', amount: 1, mode: 'Cash', date: '2026-11-30' });
  assert.equal(bad.status, 400);
});

test('friend EMI: add, mark received in a month, people stats', async () => {
  const card = (await agent.get('/api/cards')).body.find((c) => c.name === 'Amazon Pay ICICI');
  const mani = (await agent.get('/api/people')).body.find((p) => p.name === 'Mani');
  const add = await agent.post('/api/emis').send({ cardId: card.id, item: 'iPhone', forWho: 'friend', personId: mani.id, monthly: 5000, totalMonths: 12, atYm: '2026-10', alreadyPaid: 2 });
  assert.equal(add.status, 201);
  assert.equal(add.body.startYm, '2026-08');

  const recv = (await agent.get('/api/months/2026-10')).body.receivables.find((r) => r.emiId === add.body.id);
  assert.deepEqual([recv.amount, recv.status, recv.inst.n], [5000, 'pending', 3]);
  await agent.patch(`/api/months/2026-10/emis/${add.body.id}`).send({ received: 'done' });

  const stats = (await agent.get('/api/people?at=2026-10')).body.find((p) => p.name === 'Mani');
  assert.equal(stats.runningEmis, 1);
  assert.equal(stats.leftToRecover, 5000 * 9); // 10 left incl. October, October already received
  assert.equal(stats.receivedSoFar, 6000 + 5000);
  assert.equal((await agent.delete(`/api/people/${mani.id}`)).status, 409);
});

test('cards in use cannot be deleted; year and installments endpoints work', async () => {
  const axis = (await agent.get('/api/cards')).body.find((c) => c.name === 'Flipkart Axis');
  assert.equal((await agent.delete(`/api/cards/${axis.id}`)).status, 409);
  const year = (await agent.get('/api/years/2026')).body;
  assert.ok(year.trackedCount >= 10);
  const inst = (await agent.get('/api/installments?at=2026-10')).body;
  assert.equal(inst[0].endYm <= inst.at(-1).endYm, true);
});

test('edit every field of a bill', async () => {
  const oct = (await agent.get('/api/months/2026-10')).body;
  const yt = oct.bills.find((b) => b.name === 'YouTube');
  const res = await agent.patch(`/api/bills/${yt.id}`).send({ name: 'YouTube Premium', amount: '149', category: 'sub', dueDay: 20, note: 'Family plan' });
  assert.equal(res.status, 200);
  const b = (await agent.get('/api/months/2026-10')).body.bills.find((x) => x.id === yt.id);
  assert.deepEqual([b.name, b.amount, b.dueDay, b.note], ['YouTube Premium', 149, 20, 'Family plan']);
  assert.equal((await agent.patch(`/api/bills/${yt.id}`).send({ dueDay: 40 })).status, 400);
  await agent.post(`/api/undo/${res.body.undoToken}`);
});

test('itemised card spends add to and come off “my spends”', async () => {
  const card = (await agent.get('/api/cards')).body.find((c) => c.name === 'Amazon Pay ICICI');
  const cardOf = async () => (await agent.get('/api/months/2026-10')).body.cards.find((c) => c.id === card.id);
  const before = await cardOf();
  assert.deepEqual([before.itemised, before.notItemised], [0, before.spends]);

  const add = await agent.post(`/api/months/2026-10/cards/${card.id}/spends`).send({ name: 'Supermarket', amount: 321, date: '2026-10-10' });
  assert.equal(add.status, 201);
  assert.equal(add.body.message, 'Supermarket ₹321 added to Amazon Pay ICICI');
  const after = await cardOf();
  assert.equal(after.spends, before.spends + 321);
  assert.deepEqual(after.items.map((i) => [i.name, i.amount, i.date]), [['Supermarket', 321, '2026-10-10']]);
  assert.deepEqual([after.itemised, after.notItemised], [321, before.spends]);

  // "My spends" can't be set below what's itemised.
  assert.equal((await agent.put(`/api/months/2026-10/cards/${card.id}/bill`).send({ spends: 100 })).status, 400);
  assert.equal((await agent.post(`/api/months/2026-10/cards/${card.id}/spends`).send({ name: 'x', amount: 5, date: '2026-09-30' })).status, 400);

  assert.equal((await agent.delete(`/api/card-spends/${after.items[0].id}`)).status, 200);
  const removed = await cardOf();
  assert.deepEqual([removed.spends, removed.items.length], [before.spends, 0]);
});

test('edit EMI details, including switching it from a friend to me', async () => {
  const card = (await agent.get('/api/cards')).body.find((c) => c.name === 'HDFC Swiggy');
  const balaji = (await agent.get('/api/people')).body.find((p) => p.name === 'Balaji');
  const add = await agent.post('/api/emis').send({ cardId: card.id, item: 'Laptop', forWho: 'friend', personId: balaji.id, monthly: 4000, totalMonths: 6, startYm: '2026-11' });
  const res = await agent.patch(`/api/emis/${add.body.id}`).send({ item: 'MacBook', forWho: 'me', totalMonths: 12, startYm: '2026-12' });
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.item, res.body.forWho, res.body.personId, res.body.totalMonths, res.body.startYm], ['MacBook', 'me', null, 12, '2026-12']);
  assert.equal((await agent.patch(`/api/emis/${add.body.id}`).send({ forWho: 'friend' })).status, 400);
  await agent.delete(`/api/emis/${add.body.id}`);
});

test('installment plans add, change and remove their monthly rows from the viewed month on', async () => {
  const people = (await agent.get('/api/people')).body;
  const mohan = people.find((p) => p.name === 'Mohan');
  // An "out" plan started in October: a bill appears in October and in the later months that exist.
  const add = await agent.post('/api/plans').send({ name: 'Sister · college fees', direction: 'out', category: 'fam', monthly: 5000, totalInstallments: 3, alreadyPaid: 0, atYm: '2026-10' });
  assert.equal(add.status, 201);
  assert.equal(add.body.startYm, '2026-10');
  const billIn = async (ym) => (await agent.get(`/api/months/${ym}`)).body.bills.find((b) => b.planId === add.body.id);
  assert.deepEqual((await billIn('2026-10')).inst, { n: 1, total: 3, ongoing: false });
  assert.equal((await billIn('2026-10')).amount, 5000);
  assert.equal(await billIn('2026-09'), undefined, 'earlier months untouched');

  // Pay October, then raise the amount from October: October stays (paid), later unpaid ones change.
  await agent.patch(`/api/bills/${(await billIn('2026-10')).id}`).send({ status: 'paid' });
  assert.equal((await agent.patch(`/api/plans/${add.body.id}`).send({ monthly: 6000, atYm: '2026-10' })).status, 200);
  assert.equal((await billIn('2026-10')).amount, 5000);

  // An "in" plan needs a person and shows up as money owed to me.
  assert.equal((await agent.post('/api/plans').send({ name: 'bike loan', direction: 'in', monthly: 1000, totalInstallments: 4, atYm: '2026-10' })).status, 400);
  const inPlan = await agent.post('/api/plans').send({ name: 'bike loan', direction: 'in', personId: mohan.id, monthly: 1000, totalInstallments: 4, atYm: '2026-10' });
  const recv = (await agent.get('/api/months/2026-10')).body.receivables.find((r) => r.planId === inPlan.body.id);
  assert.deepEqual([recv.name, recv.amount, recv.status], ['Mohan · bike loan', 1000, 'pending']);

  // Removing: unpaid rows go, the paid October bill stays as a plain bill.
  assert.equal((await agent.delete(`/api/plans/${add.body.id}?at=2026-10`)).status, 200);
  const octBills = (await agent.get('/api/months/2026-10')).body.bills;
  const kept = octBills.find((b) => b.name === 'Sister · college fees');
  assert.deepEqual([kept.planId, kept.status], [null, 'paid']);
  assert.equal((await agent.delete(`/api/plans/${inPlan.body.id}?at=2026-10`)).status, 200);
  assert.ok(!(await agent.get('/api/months/2026-10')).body.receivables.some((r) => r.name === 'Mohan · bike loan'));
});

test('rolling over adds plans that start in the new month', async () => {
  await agent.post('/api/plans').send({ name: 'Insurance', direction: 'out', category: 'inv', monthly: 2500, totalInstallments: 12, startYm: '2027-01', atYm: '2026-10' });
  const jan = await agent.post('/api/months/2027-01').send({ mode: 'rollover' });
  assert.equal(jan.status, 201);
  const ins = jan.body.month.bills.find((b) => b.name === 'Insurance');
  assert.deepEqual([ins.amount, ins.category, ins.inst], [2500, 'inv', { n: 1, total: 12, ongoing: false }]);
});

test('each account only sees its own data', async () => {
  const other = { identifier: 'friend@example.com', password: 'friend-password-1' };
  await User.create({ email: other.identifier, passwordHash: await bcrypt.hash(other.password, 4) });
  const friend = request.agent(app);
  assert.equal((await friend.post('/api/auth/login').send(other)).status, 200);

  // A new account starts empty, even for months the first account has.
  assert.equal((await friend.get('/api/months/2026-10')).body.exists, false);
  assert.deepEqual((await friend.get('/api/cards')).body, []);
  assert.deepEqual((await friend.get('/api/people')).body, []);

  // It can set up the same month without clashing, and the first account doesn't see it.
  assert.equal((await friend.post('/api/months/2026-10').send({ mode: 'blank' })).status, 201);
  assert.equal((await friend.patch('/api/months/2026-10').send({ budget: 12345 })).status, 200);
  assert.notEqual((await agent.get('/api/months/2026-10')).body.budget, 12345);

  // Ids from another account are "not found", never readable or changeable.
  const myBill = (await agent.get('/api/months/2026-10')).body.bills[0];
  assert.equal((await friend.patch(`/api/bills/${myBill.id}`).send({ status: 'paid' })).status, 404);
  assert.equal((await friend.delete(`/api/bills/${myBill.id}`)).status, 404);
  assert.equal((await agent.get('/api/months/2026-10')).body.bills[0].status, myBill.status);
});

test('look & feel is saved per account', async () => {
  assert.deepEqual((await agent.get('/api/auth/me')).body.prefs, { theme: null, accent: null, lang: null, sidebar: null, sidebarPinned: null, aiName: null, calculator: null });
  assert.equal((await agent.patch('/api/auth/prefs').send({ theme: 'purple' })).status, 400);
  assert.equal((await agent.patch('/api/auth/prefs').send({ accent: 'red' })).status, 400);
  const res = await agent.patch('/api/auth/prefs').send({ theme: 'dark', accent: '#10b981' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.prefs, { theme: 'dark', accent: '#10B981', lang: null, sidebar: null, sidebarPinned: null, aiName: null, calculator: null });
  // Changing one leaves the other as it was.
  assert.deepEqual((await agent.patch('/api/auth/prefs').send({ theme: 'light' })).body.prefs, { theme: 'light', accent: '#10B981', lang: null, sidebar: null, sidebarPinned: null, aiName: null, calculator: null });
  // Home language: Tamil / Telugu / Hindi or none.
  assert.equal((await agent.patch('/api/auth/prefs').send({ lang: 'fr' })).status, 400);
  assert.equal((await agent.patch('/api/auth/prefs').send({ lang: 'ta' })).body.prefs.lang, 'ta');
  assert.equal((await agent.patch('/api/auth/prefs').send({ lang: null })).body.prefs.lang, null);
  // A fresh sign-in (another device) gets them back; another account has its own.
  const other = request.agent(app);
  await other.post('/api/auth/login').send(LOGIN);
  assert.deepEqual((await other.get('/api/auth/me')).body.prefs, { theme: 'light', accent: '#10B981', lang: null, sidebar: null, sidebarPinned: null, aiName: null, calculator: null });
  const friend = request.agent(app);
  await friend.post('/api/auth/login').send({ identifier: 'friend@example.com', password: 'friend-password-1' });
  assert.deepEqual((await friend.get('/api/auth/me')).body.prefs, { theme: null, accent: null, lang: null, sidebar: null, sidebarPinned: null, aiName: null, calculator: null });
});

test('web sidebar style and pin are saved per account', async () => {
  assert.equal((await agent.patch('/api/auth/prefs').send({ sidebar: 'floating' })).status, 400);
  assert.equal((await agent.patch('/api/auth/prefs').send({ sidebarPinned: 'yes' })).status, 400);
  const prefs = (await agent.patch('/api/auth/prefs').send({ sidebar: 'pin', sidebarPinned: false })).body.prefs;
  assert.deepEqual([prefs.sidebar, prefs.sidebarPinned, prefs.accent], ['pin', false, '#10B981']); // the rest is kept
  assert.equal((await agent.get('/api/auth/me')).body.prefs.sidebarPinned, false);
  assert.equal((await agent.patch('/api/auth/prefs').send({ calculator: 'off' })).status, 400);
  assert.equal((await agent.patch('/api/auth/prefs').send({ calculator: false })).body.prefs.calculator, false);
  assert.equal((await agent.patch('/api/auth/prefs').send({ sidebar: 'classic' })).body.prefs.sidebar, 'classic');
});

test('each person can rename the AI (default Kanakku)', async () => {
  assert.equal((await agent.get('/api/auth/me')).body.prefs.aiName, null); // null = Kanakku
  assert.equal((await agent.patch('/api/auth/prefs').send({ aiName: 'x'.repeat(25) })).status, 400);
  assert.equal((await agent.patch('/api/auth/prefs').send({ aiName: '<b>Hi</b>' })).status, 400);
  assert.equal((await agent.patch('/api/auth/prefs').send({ aiName: '  Mitra   ji ' })).body.prefs.aiName, 'Mitra ji');
  assert.equal((await agent.patch('/api/auth/prefs').send({ aiName: 'கணக்கு' })).body.prefs.aiName, 'கணக்கு');
  assert.equal((await agent.patch('/api/auth/prefs').send({ aiName: '' })).body.prefs.aiName, null); // back to the default
});

test('change password: needs the current one, then the new one works', async () => {
  assert.equal((await agent.post('/api/auth/password').send({ current: 'wrong-password', next: 'new-password-1' })).status, 400);
  assert.equal((await agent.post('/api/auth/password').send({ current: LOGIN.password, next: 'short' })).status, 400);
  assert.equal((await agent.post('/api/auth/password').send({ current: LOGIN.password, next: 'new-password-1' })).status, 200);
  assert.equal((await request(app).post('/api/auth/login').send(LOGIN)).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ ...LOGIN, password: 'new-password-1' })).status, 200);
});

test('admin: only the admin manages logins, and never sees money data', async () => {
  // Not an admin yet → refused.
  assert.equal((await agent.get('/api/admin/users')).status, 403);
  const { ensureAdmin } = await import('../src/services/ownerMigration.js');
  assert.equal(await ensureAdmin(), LOGIN.identifier); // the first account becomes the admin
  assert.equal(await ensureAdmin(), null); // …only once
  assert.equal((await agent.get('/api/auth/me')).body.isAdmin, true);

  const { users: list, maxUsers } = (await agent.get('/api/admin/users')).body;
  assert.equal(maxUsers, 25);
  assert.ok(list.length >= 2);
  assert.ok(list.every((u) => !('passwordHash' in u) && !('budget' in u)));

  // Add a friend: needs a valid login and an 8+ character password; no duplicates.
  assert.equal((await agent.post('/api/admin/users').send({ email: 'bad', password: 'long-enough-1' })).status, 400);
  assert.equal((await agent.post('/api/admin/users').send({ email: 'pal@example.com', password: 'short' })).status, 400);
  const add = await agent.post('/api/admin/users').send({ email: 'Pal@Example.com', phone: '+91 91234 56789', password: 'temp-pass-1' });
  assert.equal(add.status, 201);
  assert.deepEqual([add.body.email, add.body.phone, add.body.isAdmin], ['pal@example.com', '9123456789', false]);
  assert.equal((await agent.post('/api/admin/users').send({ email: 'pal@example.com', password: 'temp-pass-1' })).status, 409);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: '9123456789', password: 'temp-pass-1' })).status, 200);

  // Reset their password.
  assert.equal((await agent.post(`/api/admin/users/${add.body.id}/password`).send({ password: 'reset-pass-1' })).status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: 'pal@example.com', password: 'temp-pass-1' })).status, 401);
  const pal = request.agent(app);
  assert.equal((await pal.post('/api/auth/login').send({ identifier: 'pal@example.com', password: 'reset-pass-1' })).status, 200);

  // The new friend is not an admin.
  assert.equal((await pal.get('/api/admin/users')).status, 403);
  assert.equal((await pal.post(`/api/admin/users/${add.body.id}/password`).send({ password: 'hijack-pass-1' })).status, 403);

  // AI is off for a new friend (it simply isn't there) until the admin switches it on; the admin always has it.
  assert.equal(add.body.aiAllowed, false);
  assert.equal((await pal.get('/api/auth/me')).body.aiAllowed, false);
  assert.equal((await pal.get('/api/ai/status')).status, 404);
  assert.equal((await pal.post('/api/ai/summary/2026-10')).status, 404);
  assert.equal((await agent.get('/api/ai/status')).status, 200);
  assert.equal((await pal.patch(`/api/admin/users/${add.body.id}/ai`).send({ allowed: true })).status, 403);
  assert.equal((await agent.patch(`/api/admin/users/${add.body.id}/ai`).send({ allowed: 'yes' })).status, 400);
  const on = await agent.patch(`/api/admin/users/${add.body.id}/ai`).send({ allowed: true });
  assert.equal(on.body.aiAllowed, true);
  assert.equal((await pal.get('/api/auth/me')).body.aiAllowed, true);
  assert.equal((await pal.get('/api/ai/status')).status, 200);
  const adminId = list.find((u) => u.isAdmin).id;
  assert.equal((await agent.patch(`/api/admin/users/${adminId}/ai`).send({ allowed: false })).status, 400);
  await agent.patch(`/api/admin/users/${add.body.id}/ai`).send({ allowed: false });
  assert.equal((await pal.get('/api/ai/status')).status, 404);

  // No more than MAX_USERS logins in total.
  const saved = config.maxUsers;
  try {
    config.maxUsers = (await User.countDocuments());
    const full = await agent.post('/api/admin/users').send({ email: 'one-too-many@example.com', password: 'temp-pass-1' });
    assert.equal(full.status, 409);
    assert.match(full.body.error, /most allowed/);
  } finally {
    config.maxUsers = saved;
  }

  // Delete a login: only the admin, never the admin's own; the person can't sign in and their data is gone.
  assert.equal((await pal.post('/api/people').send({ name: 'Pal friend' })).status, 201);
  const { Person } = await import('../src/models/index.js');
  const palPeople = () => Person.collection.countDocuments({ owner: new mongoose.Types.ObjectId(add.body.id) });
  assert.equal(await palPeople(), 1);
  assert.equal((await pal.delete(`/api/admin/users/${add.body.id}`)).status, 403);
  assert.equal((await agent.delete(`/api/admin/users/${adminId}`)).status, 400);
  assert.equal((await agent.delete(`/api/admin/users/${add.body.id}`)).status, 200);
  assert.equal(await palPeople(), 0);
  assert.equal((await pal.get('/api/people')).status, 401); // their open session stops working
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: 'pal@example.com', password: 'reset-pass-1' })).status, 401);
  assert.ok(!(await agent.get('/api/admin/users')).body.users.some((u) => u.id === add.body.id));
  assert.equal((await agent.delete(`/api/admin/users/${add.body.id}`)).status, 404);
  assert.ok((await agent.get('/api/people')).body.length > 0); // the admin's own data is untouched
});

test('yearly bank/cash EMI for a friend, and "I owe them" rows in Need to pay', async () => {
  const balaji = (await agent.get('/api/people')).body.find((p) => p.name === 'Balaji');
  // Acceptance check 3: Sep 2024 → Sep 2034, ₹12,000 a year, paid from the bank.
  const add = await agent.post('/api/emis').send({ cardId: null, item: 'Insurance', forWho: 'friend', personId: balaji.id, monthly: 12000, freq: 'yearly', totalMonths: 11, startYm: '2024-09' });
  assert.equal(add.status, 201);
  assert.deepEqual([add.body.cardId, add.body.freq], [null, 'yearly']);
  assert.ok(!(await agent.get('/api/months/2026-10')).body.bills.some((b) => b.emiId === add.body.id), 'not due in Oct 2026');

  // In a month it's due, its row can be marked paid (stored on the month, per plan).
  await agent.post('/api/months/2027-09').send({ mode: 'blank' });
  const row = async () => (await agent.get('/api/months/2027-09')).body.bills.find((b) => b.emiId === add.body.id);
  assert.deepEqual([(await row()).inst.n, (await row()).status], [4, 'unpaid']);
  assert.equal((await agent.patch(`/api/months/2027-09/emis/${add.body.id}`).send({ paid: 'paid' })).status, 200);
  assert.equal((await row()).status, 'paid');

  // Acceptance check 2: "I owe Mohan ₹450" shows under Money I owe; ticking it marks the People entry paid back.
  const mohan = (await agent.get('/api/people')).body.find((p) => p.name === 'Mohan');
  const before = (await agent.get('/api/months/2026-10')).body.totals;
  const owe = await agent.post('/api/months/2026-10/people-entries').send({ direction: 'out', personId: mohan.id, name: 'Mohan', amount: 450 });
  assert.equal(owe.status, 201);
  const oct = (await agent.get('/api/months/2026-10')).body;
  const oweRow = oct.bills.find((b) => b.kind === 'owe' && b.entryId === owe.body.id);
  assert.deepEqual([oweRow.category, oweRow.amount, oweRow.status], ['owe', 450, 'unpaid']);
  assert.equal(oct.totals.toPay - before.toPay, 450);
  assert.equal(oct.totals.balance - before.balance, -450);
  await agent.patch(`/api/people-entries/${owe.body.id}`).send({ status: 'done' });
  const after = (await agent.get('/api/months/2026-10')).body;
  assert.equal(after.bills.find((b) => b.entryId === owe.body.id).status, 'paid');
  assert.equal(after.payables.find((r) => r.id === owe.body.id).status, 'done');
  await agent.delete(`/api/people-entries/${owe.body.id}`);
  await agent.delete(`/api/emis/${add.body.id}`);
});

test('a new card is in every month from the viewed one on, and in new blank months', async () => {
  const add = await agent.post('/api/cards').send({ name: 'Test Ongoing Card', last4: '4321', network: 'Visa', addToYm: '2026-09' });
  assert.equal(add.status, 201);
  const hasCard = async (ym) => (await agent.get(`/api/months/${ym}`)).body.bills.some((b) => b.cardId === add.body.id);
  assert.deepEqual([await hasCard('2026-08'), await hasCard('2026-09'), await hasCard('2026-10'), await hasCard('2027-09')], [false, true, true, true]);
  await agent.post('/api/months/2028-01').send({ mode: 'blank' });
  assert.ok(await hasCard('2028-01'));

  // A card missing from a later month (added before this rule) is filled in on start – never earlier months.
  const { BillItem } = await import('../src/models/index.js');
  const { fillCardBills } = await import('../src/services/ownerMigration.js');
  await BillItem.collection.deleteOne({ card: new mongoose.Types.ObjectId(add.body.id), ym: '2026-10' });
  assert.equal(await hasCard('2026-10'), false);
  assert.ok((await fillCardBills()) >= 1);
  assert.deepEqual([await hasCard('2026-08'), await hasCard('2026-10')], [false, true]);
  assert.equal(await fillCardBills(), 0); // nothing left to do
  await agent.patch(`/api/cards/${add.body.id}`).send({ closed: true });
});

test('EMIs and plans can be ongoing, with no end date', async () => {
  const emi = await agent.post('/api/emis').send({ cardId: null, item: 'House rent', monthly: 15000, ongoing: true, startYm: '2026-10' });
  assert.equal(emi.status, 201);
  assert.deepEqual([emi.body.totalMonths, emi.body.ongoing], [null, true]);
  const plan = await agent.post('/api/plans').send({ name: 'Mom support', direction: 'out', monthly: 5000, ongoing: true, atYm: '2026-10' });
  assert.equal(plan.status, 201);
  assert.match(plan.body.source, /ongoing/);

  // Years later it's still there, counting up, never "X of Y".
  const later = (await agent.get('/api/months/2028-01')).body;
  const rent = later.bills.find((b) => b.emiId === emi.body.id);
  assert.deepEqual([rent.inst.n, rent.inst.total, rent.inst.ongoing], [16, null, true]);
  assert.match(rent.note, /ongoing/);
  const mom = later.bills.find((b) => b.planId === plan.body.id);
  assert.deepEqual([mom.amount, mom.inst.n, mom.inst.ongoing], [5000, 16, true]);

  // The Installments list keeps them (last, with no closing month).
  const list = (await agent.get('/api/installments?at=2026-10')).body;
  const rows = list.filter((r) => r.ongoing);
  assert.deepEqual(rows.map((r) => [r.endYm, r.monthsLeft]), [[null, null], [null, null]]);
  assert.ok(list.at(-1).ongoing);

  await agent.delete(`/api/emis/${emi.body.id}`);
  await agent.delete(`/api/plans/${plan.body.id}?at=2026-10`);
});

test('daily spends: today only, never part of budget or balance', async () => {
  const { todayInIndia, addMonths } = await import('../src/lib/ym.js');
  const today = todayInIndia();
  const ym = today.slice(0, 7);
  const before = (await agent.get(`/api/months/${ym}`)).body.totals;

  const put = await agent.put(`/api/daily/${today}`).send({
    teaMorning: 15, breakfast: '60', lunch: 120, snacks: 0, teaEvening: 15, dinner: '₹150',
    others: [{ name: 'Auto', amount: 40 }, { name: 'Water bottle', amount: 20 }, { name: '', amount: '' }],
  });
  assert.equal(put.status, 200);
  assert.equal(put.body.total, 420);
  assert.equal(put.body.others.length, 2); // the empty row isn't kept

  const month = (await agent.get(`/api/daily?ym=${ym}`)).body;
  assert.deepEqual([month.today, month.monthTotal, month.days.at(-1).date], [today, 420, today]);

  // Earlier and future days can't be changed; bad amounts are refused.
  const d = new Date(`${today}T12:00:00Z`);
  const shift = (n) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
  assert.equal((await agent.put(`/api/daily/${shift(-1)}`).send({ lunch: 100 })).status, 400);
  assert.equal((await agent.put(`/api/daily/${shift(1)}`).send({ lunch: 100 })).status, 400);
  assert.equal((await agent.put(`/api/daily/${today}`).send({ lunch: -5 })).status, 400);
  assert.equal((await agent.get(`/api/daily?ym=${addMonths(ym, 1)}`)).body.days.length, 0);

  // The month's budget, bills and balance don't change.
  assert.deepEqual((await agent.get(`/api/months/${ym}`)).body.totals, before);

  // Clearing everything removes the day.
  assert.equal((await agent.put(`/api/daily/${today}`).send({})).body.total, 0);
  assert.equal((await agent.get(`/api/daily?ym=${ym}`)).body.days.length, 0);
});

test('logout clears the session', async () => {
  await agent.post('/api/auth/logout');
  assert.equal((await agent.get('/api/months/2026-10')).status, 401);
});
