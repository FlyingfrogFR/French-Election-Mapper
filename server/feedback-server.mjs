#!/usr/bin/env node
/**
 * Reference implementation of the optional anonymous feedback endpoint. Zero dependencies.
 *
 * Design constraints (GDPR data minimisation):
 *   - accepts only the fixed payload produced by src/lib/feedback.ts, rejects anything else;
 *   - stores nothing but aggregated counters per UTC day: no IP, no user agent, no timestamp, no raw event;
 *   - rate limiting is in-memory only, keyed by a salted hash of the IP that is regenerated every hour and never written to disk;
 *   - CORS restricted to the configured origins.
 *
 * Usage: FEEDBACK_ORIGINS=https://example.org PORT=8787 node server/feedback-server.mjs
 * GET /stats returns the aggregated counters (public, they contain no personal data).
 */
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const AGREEMENTS = new Set(['yes', 'partly', 'no']);
const ID = /^[a-z0-9-]{1,40}$/;
const BUCKET = /^\d{1,2}-\d{1,2}$/;
const ANSWERED = new Set(['<20', '20-39', '40-79', '80-119', '120+']);
const VERSION = /^[0-9a-f]{12}$/;

export function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'payload must be an object';
  const keys = Object.keys(body).sort().join(',');
  if (keys !== 'agreement,answeredBucket,confidenceBucket,datasetVersion,expected,matchBucket,suggested,v') return 'unexpected fields';
  if (body.v !== 1) return 'unsupported version';
  if (!VERSION.test(body.datasetVersion)) return 'bad datasetVersion';
  if (!ID.test(body.suggested)) return 'bad suggested';
  if (!AGREEMENTS.has(body.agreement)) return 'bad agreement';
  if (body.expected !== null && !ID.test(body.expected)) return 'bad expected';
  if (!BUCKET.test(body.matchBucket) || !BUCKET.test(body.confidenceBucket)) return 'bad bucket';
  if (!ANSWERED.has(body.answeredBucket)) return 'bad answeredBucket';
  return null;
}

export function createStore(file) {
  let data = { counters: {} };
  if (file) {
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      /* first run */
    }
  }
  const persist = () => {
    if (!file) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
  };
  return {
    record(p, day = new Date().toISOString().slice(0, 10)) {
      const key = [day, p.datasetVersion, p.suggested, p.agreement, p.expected ?? '-', p.matchBucket, p.confidenceBucket, p.answeredBucket].join('|');
      data.counters[key] = (data.counters[key] ?? 0) + 1;
      persist();
    },
    snapshot() {
      return JSON.parse(JSON.stringify(data));
    },
  };
}

export function createRateLimiter({ perHour = 20 } = {}) {
  let salt = randomBytes(16);
  let saltAt = Date.now();
  const hits = new Map();
  return {
    allow(ip, now = Date.now()) {
      if (now - saltAt > 3_600_000) {
        salt = randomBytes(16);
        saltAt = now;
        hits.clear();
      }
      const key = createHash('sha256').update(salt).update(String(ip)).digest('base64');
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return n <= perHour;
    },
  };
}

export function createApp({ origins = [], store = createStore(null), limiter = createRateLimiter() } = {}) {
  const allowed = new Set(origins);
  return createServer((req, res) => {
    const origin = req.headers.origin;
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    if (origin && allowed.has(origin)) {
      headers['access-control-allow-origin'] = origin;
      headers['access-control-allow-methods'] = 'POST, GET, OPTIONS';
      headers['access-control-allow-headers'] = 'content-type';
      headers.vary = 'Origin';
    }
    const send = (status, body) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') return send(204, {});
    if (req.method === 'GET' && req.url === '/stats') return send(200, store.snapshot());
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/feedback') return send(404, { error: 'not found' });
    if (origin && !allowed.has(origin)) return send(403, { error: 'origin not allowed' });
    // The socket address is used only for in-memory rate limiting and never stored or logged.
    if (!limiter.allow(req.socket.remoteAddress ?? '')) return send(429, { error: 'too many requests' });
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2048) req.destroy();
    });
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { error: 'invalid json' });
      }
      const err = validatePayload(body);
      if (err) return send(400, { error: err });
      store.record(body);
      send(202, { ok: true });
    });
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const port = Number(process.env.PORT ?? 8787);
  const origins = (process.env.FEEDBACK_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const store = createStore(process.env.FEEDBACK_STORE ?? 'server/store/feedback-counters.json');
  createApp({ origins, store }).listen(port, () => {
    console.log(`feedback endpoint listening on :${port} (origins: ${origins.join(', ') || 'none — same-origin only'})`);
  });
}
