import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, createRateLimiter, createStore, validatePayload } from './feedback-server.mjs';

const valid = {
  v: 1,
  datasetVersion: '9f4f0cf364ea',
  suggested: 'melenchon',
  agreement: 'partly',
  expected: 'roussel',
  matchBucket: '70-79',
  confidenceBucket: '60-69',
  answeredBucket: '80-119',
};

test('accepts the canonical payload and rejects anything else', () => {
  assert.equal(validatePayload(valid), null);
  assert.equal(validatePayload({ ...valid, expected: null }), null);
  assert.match(validatePayload({ ...valid, ip: '1.2.3.4' }), /unexpected/);
  assert.match(validatePayload({ ...valid, suggested: 'DROP TABLE' }), /suggested/);
  assert.match(validatePayload({ ...valid, agreement: 'maybe' }), /agreement/);
  assert.match(validatePayload({ ...valid, matchBucket: '77' }), /bucket/);
  assert.match(validatePayload([]), /object/);
});

test('store only keeps day-level aggregated counters', () => {
  const store = createStore(null);
  store.record(valid, '2026-09-20');
  store.record(valid, '2026-09-20');
  const snap = store.snapshot();
  const keys = Object.keys(snap.counters);
  assert.equal(keys.length, 1);
  assert.equal(snap.counters[keys[0]], 2);
  assert.ok(!JSON.stringify(snap).includes('T'), 'no timestamp finer than the day');
});

test('rate limiter caps per hour without persisting anything', () => {
  const l = createRateLimiter({ perHour: 2 });
  assert.equal(l.allow('a'), true);
  assert.equal(l.allow('a'), true);
  assert.equal(l.allow('a'), false);
  assert.equal(l.allow('b'), true);
  assert.equal(l.allow('a', Date.now() + 3_700_000), true, 'window resets after an hour');
});

test('HTTP: CORS, validation, 202 on success, 403 on foreign origin', async () => {
  const store = createStore(null);
  const server = createApp({ origins: ['https://boussole.example'], store });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, origin) =>
    fetch(`${base}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    });
  let r = await post(valid, 'https://boussole.example');
  assert.equal(r.status, 202);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://boussole.example');
  r = await post(valid, 'https://evil.example');
  assert.equal(r.status, 403);
  r = await post({ ...valid, extra: 1 }, 'https://boussole.example');
  assert.equal(r.status, 400);
  r = await fetch(`${base}/stats`);
  assert.equal(r.status, 200);
  const stats = await r.json();
  assert.equal(Object.values(stats.counters).reduce((a, b) => a + b, 0), 1);
  r = await fetch(`${base}/nope`);
  assert.equal(r.status, 404);
  server.close();
});
