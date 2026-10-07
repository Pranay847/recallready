import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer } from '../server/index.mjs';
import { hostingConfig, createHostingGuard } from '../server/hosting.mjs';

const code = 'test-only-access-code-123456';
const env = { RECALLREADY_HOSTED: 'true', PUBLIC_URL: 'https://demo.example.com', DEMO_ACCESS_CODE: code, NEBIUS_API_KEY: 'test-only-api-key' };
const notice = { product: 'Bar', brand: 'Test', sku: 'S-1', upc: '', lotCodes: ['L-1'], reason: 'Test only', date: '', instructions: '', source: { name: 'test.txt', text: 'Recall Bar lot L-1.' }, confirmed: false };

async function withServer(run, overrides = {}) {
  let calls = 0;
  const server = createServer({ env, fetchImpl: async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(notice) }, finish_reason: 'stop' }] })); }, ...overrides });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const send = (pathname, options = {}) => new Promise((resolve, reject) => {
    const request = httpRequest(`http://127.0.0.1:${server.address().port}${pathname}`, {
      method: options.method || 'GET',
      headers: { Host: 'demo.example.com', ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}), ...options.headers },
    }, response => {
      let body = ''; response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body, json: () => JSON.parse(body) }));
    });
    request.on('error', reject);
    request.end(options.body === undefined ? undefined : JSON.stringify(options.body));
  });
  try { await run(send, () => calls); }
  finally { server.close(); await once(server, 'close'); }
}

test('hosted configuration requires an HTTPS origin and access code before enabling paid AI', () => {
  for (const changes of [{ PUBLIC_URL: '' }, { PUBLIC_URL: 'http://demo.example.com' }, { PUBLIC_URL: 'https://user:password@demo.example.com' }, { PUBLIC_URL: 'https://demo.example.com/path' }, { DEMO_ACCESS_CODE: '' }]) {
    assert.throws(() => hostingConfig({ ...env, ...changes }));
  }
  assert.equal(hostingConfig({ RECALLREADY_HOSTED: 'true', RENDER_EXTERNAL_URL: env.PUBLIC_URL }).host, 'demo.example.com');
  assert.equal(hostingConfig({}).hosted, false);
});

test('hosted public demo works, rejects foreign hosts and origins, and supports health probes', async () => {
  await withServer(async send => {
    assert.equal((await send('/api/demo')).status, 200);
    assert.equal((await send('/api/demo', { headers: { Host: 'evil.example.com' } })).status, 403);
    assert.equal((await send('/api/demo', { headers: { Host: '127.0.0.1' } })).status, 403);
    const health = await send('/api/health', { headers: { Host: '127.0.0.1' } });
    assert.equal(health.status, 200);
    assert.equal(health.json().accessRequired, true);
    assert.equal(health.body.includes(code), false);
    assert.equal(health.body.includes(env.NEBIUS_API_KEY), false);
    assert.match(health.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal((await send('/api/access', { method: 'POST', headers: { origin: 'https://evil.example.com', 'x-demo-access-code': code }, body: {} })).status, 403);
    assert.equal((await send('/api/access', { method: 'POST', headers: { origin: env.PUBLIC_URL, 'x-demo-access-code': code }, body: {} })).status, 200);
  });
});

test('extraction authenticates before calling Nebius and rejects oversized documents', async () => {
  await withServer(async (send, calls) => {
    const body = { filename: 'test.txt', text: notice.source.text };
    for (const headers of [{}, { 'x-demo-access-code': 'incorrect' }]) {
      assert.equal((await send('/api/extract', { method: 'POST', headers, body })).status, 401);
    }
    assert.equal(calls(), 0);
    const headers = { 'x-demo-access-code': code };
    assert.equal((await send('/api/extract', { method: 'POST', headers, body: { ...body, text: 'a'.repeat(20_001) } })).status, 413);
    assert.equal(calls(), 0);
    const accepted = await send('/api/extract', { method: 'POST', headers, body });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json().pendingReview, true);
    assert.equal(calls(), 1);
  });
});

test('shared extraction rate limit blocks model calls and resets only when the window expires', async () => {
  let time = 1000;
  await withServer(async (send, calls) => {
    const options = { method: 'POST', headers: { 'x-demo-access-code': code }, body: { filename: 'test.txt', text: notice.source.text } };
    for (let n = 0; n < 20; n++) assert.equal((await send('/api/extract', options)).status, 200);
    const blocked = await send('/api/extract', options);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers['retry-after'], '3600');
    assert.equal(calls(), 20);
    assert.equal((await send('/api/demo')).status, 200);
    time += 3_600_000;
    assert.equal((await send('/api/extract', options)).status, 200);
    assert.equal(calls(), 21);
  }, { now: () => time });
});

test('concurrent extractions release slots, including after errors, without double-release', () => {
  const guard = createHostingGuard(hostingConfig(env));
  const first = guard.beginExtraction('notice');
  const second = guard.beginExtraction('notice');
  assert.throws(() => guard.beginExtraction('notice'), error => error.status === 429);
  first(); first();
  const third = guard.beginExtraction('notice');
  assert.throws(() => guard.beginExtraction('notice'), error => error.status === 429);
  second(); third();
  guard.beginExtraction('notice')();
});

test('public PDF and API mutation traffic have bounded windows', () => {
  const config = hostingConfig(env);
  const guard = createHostingGuard(config);
  const request = { method: 'POST', headers: { host: config.host, origin: config.origin } };
  for (let n = 0; n < 10; n++) guard.checkRequest(request, '/api/document');
  assert.throws(() => guard.checkRequest(request, '/api/document'), error => error.status === 429);
  const apiGuard = createHostingGuard(config);
  for (let n = 0; n < 240; n++) apiGuard.checkRequest(request, '/api/analyze');
  assert.throws(() => apiGuard.checkRequest(request, '/api/analyze'), error => error.status === 429);
});
