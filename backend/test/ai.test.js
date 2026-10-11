// AI features with a fake Claude client – no network, no cost. Uses its own test database.
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
const { setClientForTests } = await import('../src/services/ai/client.js');
const { runTool } = await import('../src/services/ai/tools.js');

const TEST_DB = (process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/monexp_test') + '_ai';
const app = createApp();
const agent = request.agent(app);

// ---- fake Anthropic client: replays scripted responses and records every request ----
const calls = [];
let script = [];
function fakeStream(message, texts) {
  const handlers = [];
  return {
    on(event, fn) { if (event === 'text') handlers.push(fn); return this; },
    async finalMessage() { for (const t of texts) handlers.forEach((fn) => fn(t)); return message; },
  };
}
const fakeClient = {
  beta: {
    messages: {
      stream(params) {
        calls.push(structuredClone(params));
        const next = script.shift();
        return fakeStream(next.message, next.texts ?? []);
      },
      async create(params) {
        calls.push(structuredClone(params));
        return script.shift().message;
      },
    },
  },
};
const msg = (stop_reason, content) => ({ model: 'claude-test', stop_reason, content });

/** Reads an SSE body into [{ event, data }]. */
const parseSse = (text) => text.trim().split('\n\n').map((chunk) => {
  const event = /^event: (.*)$/m.exec(chunk)?.[1];
  const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] ?? '{}');
  return { event, data };
});

before(async () => {
  await mongoose.connect(TEST_DB);
  assert.match(mongoose.connection.name, /_test_ai$/);
  await mongoose.connection.dropDatabase();
  await User.create({ email: 'ai@example.com', passwordHash: await bcrypt.hash('test-password-1', 4) });
  await seedSampleData();
  await agent.post('/api/auth/login').send({ identifier: 'ai@example.com', password: 'test-password-1' });
});

after(async () => {
  setClientForTests(null);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('without an API key the AI says how to set it up', async () => {
  const savedKey = config.anthropicApiKey;
  config.anthropicApiKey = '';
  setClientForTests(null);
  try {
    assert.equal((await agent.get('/api/ai/status')).body.enabled, false);
    const res = await agent.post('/api/ai/chat').send({ ym: '2026-10', messages: [{ role: 'user', content: 'Hi' }] });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /ANTHROPIC_API_KEY/);
  } finally {
    config.anthropicApiKey = savedKey;
  }
});

test('chat: Claude calls a tool, gets computed figures, and the answer streams back', async () => {
  setClientForTests(fakeClient);
  calls.length = 0;
  script = [
    { message: msg('tool_use', [{ type: 'tool_use', id: 'tu_1', name: 'get_month', input: { ym: '2026-10' } }]) },
    { message: msg('end_turn', [{ type: 'text', text: 'You have ₹10,534 left.' }]), texts: ['You have ', '₹10,534 left.'] },
  ];
  const res = await agent.post('/api/ai/chat').send({ ym: '2026-10', messages: [{ role: 'user', content: 'How much is left this month?' }] });
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/event-stream/);
  const events = parseSse(res.text);
  assert.deepEqual(events.map((e) => e.event), ['status', 'text', 'text', 'done']);
  assert.equal(events[0].data.text, 'Looking at October 2026…');
  assert.equal(events.filter((e) => e.event === 'text').map((e) => e.data.delta).join(''), 'You have ₹10,534 left.');

  // First request: model, tools, cached system prompt, and today's context on the question.
  const first = calls[0];
  assert.ok(first.model);
  assert.deepEqual(first.tools.map((t) => t.name), ['get_month', 'get_year', 'get_installments', 'get_people', 'find_payments']);
  assert.equal(first.system[0].cache_control.type, 'ephemeral');
  assert.match(first.messages.at(-1).content, /^\[Context: today is .*viewing October 2026/);

  // Second request carries the tool result – the figures come from compute.js, not the model.
  const toolResult = calls[1].messages.at(-1).content[0];
  assert.equal(toolResult.type, 'tool_result');
  assert.equal(toolResult.tool_use_id, 'tu_1');
  const figures = JSON.parse(toolResult.content);
  assert.equal(figures.totals.balanceLeft, 10534);
  assert.equal(figures.totals.balanceInclPeople, 16053);
});

test('chat: bad input to a tool is returned as an error result, not a crash', async () => {
  calls.length = 0;
  script = [
    { message: msg('tool_use', [{ type: 'tool_use', id: 'tu_2', name: 'get_month', input: { ym: 'October' } }]) },
    { message: msg('end_turn', [{ type: 'text', text: 'ok' }]), texts: ['ok'] },
  ];
  await agent.post('/api/ai/chat').send({ ym: '2026-10', messages: [{ role: 'user', content: 'x' }] });
  const result = calls[1].messages.at(-1).content[0];
  assert.equal(result.is_error, true);
  assert.match(result.content, /must look like/);
});

test('chat: history must end with a question', async () => {
  const res = await agent.post('/api/ai/chat').send({ ym: '2026-10', messages: [{ role: 'assistant', content: 'hello' }] });
  assert.equal(res.status, 400);
});

test('find_payments adds up a name across months', async () => {
  const { content } = await runTool('find_payments', { query: 'netflix', from_ym: '2026-01', to_ym: '2026-10' });
  const r = JSON.parse(content);
  assert.equal(r.matches.length, 10);
  assert.equal(r.totalPaid, 499 * 9); // October is still unpaid
  assert.equal(r.totalUnpaid, 499);
});

test('get_year gives yearly totals for EMI questions', async () => {
  const r = JSON.parse((await runTool('get_year', { year: 2026 })).content);
  assert.equal(r.monthsTracked, 10);
  assert.equal(r.totals.friendsCardEmis, 1255 + 11062 + 1673 + 1255); // Sathish ×3 (Feb override) + Aravind (Jan)
  assert.equal(r.totals.installmentPlanPayments, r.months.reduce((s, m) => s + m.installmentPlanPayments, 0));
});

test('monthly summary: generated once, saved, and marked out of date when figures change', async () => {
  calls.length = 0;
  script = [{ message: msg('end_turn', [{ type: 'text', text: 'October: ₹10,534 left.' }]) }];
  const made = await agent.post('/api/ai/summary/2026-10');
  assert.equal(made.status, 200);
  assert.equal(made.body.summary.text, 'October: ₹10,534 left.');

  // The differences against September were worked out in code, not by the model.
  const sent = JSON.parse(calls[0].messages[0].content.replace(/^Figures \(JSON\):\n/, ''));
  assert.equal(sent.changeFromPreviousMonth.balanceLeft, 10534 - (66000 - 45289));

  const got = (await agent.get('/api/ai/summary/2026-10')).body;
  assert.deepEqual([got.summary.text, got.stale], ['October: ₹10,534 left.', false]);
  await agent.patch('/api/months/2026-10').send({ budget: 70000 });
  assert.equal((await agent.get('/api/ai/summary/2026-10')).body.stale, true);
  assert.equal(calls.length, 1, 'reading a saved summary costs nothing');
});
