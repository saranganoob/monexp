// End-to-end API tests against a separate "monexp_test" database (your real data is never touched).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';

process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123';
const { config } = await import('../src/config.js');
config.jwtSecret = process.env.JWT_SECRET;
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
  await User.create({ email: LOGIN.identifier, phone: '9876543210', passwordHash: await bcrypt.hash(LOGIN.password, 4) });
  await seedSampleData();
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
  assert.deepEqual(nov.bills.find((b) => b.name === 'Dad').inst, { n: 35, total: 40 });
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

test('logout clears the session', async () => {
  await agent.post('/api/auth/logout');
  assert.equal((await agent.get('/api/months/2026-10')).status, 401);
});
