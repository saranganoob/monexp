// Production-only behaviour: serving the Angular app, security headers, sign-in rate limit.
// No database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-123';
const { config } = await import('../src/config.js');
const { createApp } = await import('../src/app.js');

const webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monexp-web-'));
fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><title>MonEXP</title><app-root></app-root>');
fs.writeFileSync(path.join(webDir, 'main-ABCD1234.js'), 'console.log(1)');

function appWith(overrides) {
  const saved = { ...config };
  Object.assign(config, overrides);
  try { return createApp(); } finally { Object.assign(config, saved); }
}

test('serves the Angular app: files, and index.html for page routes', async () => {
  const app = appWith({ webDir });
  const home = await request(app).get('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /<app-root>/);
  assert.equal(home.headers['cache-control'], 'no-cache');

  const deepLink = await request(app).get('/credit-cards');
  assert.match(deepLink.text, /<app-root>/, 'refreshing on /credit-cards still loads the app');

  const js = await request(app).get('/main-ABCD1234.js');
  assert.match(js.headers['cache-control'], /immutable/);
});

test('API addresses never fall through to the web page', async () => {
  const res = await request(appWith({ webDir })).get('/api/nope');
  assert.equal(res.status, 401); // not signed in – answered by the API, as JSON
  assert.match(res.headers['content-type'], /json/);
  assert.doesNotMatch(res.text, /<app-root>/);
});

test('security headers are set', async () => {
  const res = await request(appWith({ webDir })).get('/api/health');
  assert.match(res.headers['content-security-policy'], /default-src 'self'/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('sign-in attempts are rate limited', async () => {
  const app = appWith({ webDir, loginRateLimit: 3 });
  for (let i = 0; i < 3; i++) {
    assert.equal((await request(app).post('/api/auth/login').send({ identifier: 'not valid', password: 'x' })).status, 400);
  }
  const blocked = await request(app).post('/api/auth/login').send({ identifier: 'not valid', password: 'x' });
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Too many sign-in attempts/);
});
