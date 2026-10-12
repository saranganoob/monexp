// Live updates over WebSocket: only the same user's other pages hear about a change.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import WebSocket from 'ws';

process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123';
const { config } = await import('../src/config.js');
config.jwtSecret = process.env.JWT_SECRET;
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');
const { attachLive, CLIENT_HEADER } = await import('../src/services/live.js');

const TEST_DB = (process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/monexp_test') + '_live';
let server;
let base;

async function signIn(email) {
  await User.create({ email, passwordHash: await bcrypt.hash('test-password-1', 4) });
  const res = await request(server).post('/api/auth/login').send({ identifier: email, password: 'test-password-1' });
  return res.headers['set-cookie'][0].split(';')[0];
}

/** Opens a live connection; resolves with { ws, messages } once connected, or rejects with the HTTP status. */
function connect(cookie, origin = base) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/api/live`, { headers: { cookie: cookie || '', origin } });
    const messages = [];
    ws.on('message', (m) => messages.push(JSON.parse(m)));
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('unexpected-response', (_req, res) => reject(res.statusCode));
    ws.on('error', () => {});
  });
}
const settle = () => new Promise((r) => setTimeout(r, 150));

before(async () => {
  await mongoose.connect(TEST_DB);
  assert.match(mongoose.connection.name, /_test_live$/);
  await mongoose.connection.dropDatabase();
  server = createApp().listen(0);
  attachLive(server);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('a change reaches the same user’s other pages – not the page that made it, not other users', async () => {
  const me = await signIn('me@example.com');
  const friend = await signIn('friend@example.com');
  const laptop = await connect(me);
  const phone = await connect(me);
  const friendPage = await connect(friend);

  // The "phone" page creates a month; it marks its requests with its own id.
  const res = await request(server).post('/api/months/2026-10').set('Cookie', me).set(CLIENT_HEADER, 'phone-1').send({ mode: 'blank' });
  assert.equal(res.status, 201);
  await settle();
  assert.deepEqual(laptop.messages, [{ type: 'changed', from: 'phone-1' }]);
  assert.deepEqual(phone.messages, [{ type: 'changed', from: 'phone-1' }]); // the page itself ignores its own id
  assert.deepEqual(friendPage.messages, []);

  // Reads and failed changes don't notify anyone.
  await request(server).get('/api/months/2026-10').set('Cookie', me);
  await request(server).post('/api/months/2026-10').set('Cookie', me).send({ mode: 'blank' }); // 409: already set up
  await settle();
  assert.equal(laptop.messages.length, 1);

  // The admin (first account) sees who has the app open right now.
  const { ensureAdmin } = await import('../src/services/ownerMigration.js');
  await ensureAdmin();
  const online = async () => Object.fromEntries((await request(server).get('/api/admin/users').set('Cookie', me)).body.users.map((u) => [u.email, u.online]));
  assert.deepEqual(await online(), { 'me@example.com': true, 'friend@example.com': true });
  friendPage.ws.close();
  await settle();
  assert.deepEqual(await online(), { 'me@example.com': true, 'friend@example.com': false });

  for (const p of [laptop, phone]) p.ws.close();
});

test('live connections need a signed-in page from this site', async () => {
  const me = await signIn('other@example.com');
  await assert.rejects(connect(''), (status) => status === 401);
  await assert.rejects(connect(me, 'https://evil.example.com'), (status) => status === 403);
});
