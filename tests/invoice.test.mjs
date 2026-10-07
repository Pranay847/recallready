import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import * as ai from '../server/ai.mjs';
import { createServer } from '../server/index.mjs';

const text = 'INV-104 Cedar Sesame Bar SKU S-1 UPC 001 lot L-7: 12 cartons received at Dock A.';
const record = () => ({ id: 'INV-104', product: 'Sesame Bar', brand: 'Cedar', sku: 'S-1', upc: '001', lot: 'L-7', quantity: 12, unit: 'cartons', location: 'Dock A', source: { name: 'invented.pdf', text, row: null } });
const modelFetch = (candidate, capture = () => {}) => async (_url, options) => {
  capture(JSON.parse(options.body));
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(candidate) } }], model: 'fixture-model', usage: { prompt_tokens: 24, completion_tokens: 18 } }), { status: 200 });
};
const extract = (candidate, extra = {}) => ai.extractInventory({ filename: 'receiving.txt', text, env: { NEBIUS_API_KEY: 'key' }, fetchImpl: modelFetch(candidate), ...extra });

test('invoice candidate remains pending, pins source filename, and requests a fully strict schema', async () => {
  let request;
  const result = await extract({ records: [record()] }, { fetchImpl: modelFetch({ records: [record()] }, (value) => { request = value; }) });
  assert.equal(result.pendingReview, true);
  assert.equal(result.records[0].quantity, 12);
  assert.equal(result.records[0].source.name, 'receiving.txt');
  assert.equal(result.records[0].source.row, undefined);
  assert.equal(result.usage.promptTokens, 24);
  assert.equal(result.usage.completionTokens, 18);
  const format = request.response_format.json_schema;
  assert.equal(format.strict, true);
  assert.equal(format.schema.properties.records.maxItems, 50);
  for (const schema of [format.schema, format.schema.properties.records.items, format.schema.properties.records.items.properties.source]) {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
  }
  assert.match(request.messages[0].content, /current warehouse quantity/i);
  assert.match(request.messages[0].content, /untrusted/i);
});

test('invoice unknown quantities and missing lots remain unknown without conversion', async () => {
  for (const quote of ['Sesame Bar received.', 'Sesame Bar received: 12 pounds.']) {
    const candidate = { ...record(), id: '', lot: '', quantity: null, source: { name: 'input.txt', text: quote, row: 1 } };
    const result = await extract({ records: [candidate] }, { text: quote });
    assert.equal(result.records[0].quantity, null);
    assert.equal(result.records[0].lot, '');
    assert.equal(result.records[0].id, '');
    candidate.quantity = 12;
    const unverified = await extract({ records: [candidate] }, { text: quote });
    assert.equal(unverified.records[0].quantity, null);
  }
});

test('invoice rejects unverified source quotes, invalid quantities, malformed shapes, and too many rows', async () => {
  for (const candidate of [
    { records: [{ ...record(), source: { ...record().source, text: 'invented quote' } }] },
    ...[-1, 1.5, '12', Number.MAX_SAFE_INTEGER + 1].map((quantity) => ({ records: [{ ...record(), quantity }] })),
    { records: [{ ...record(), unit: 'pounds' }] },
    { records: [{ ...record(), lot: 'INVENTED' }] },
    { records: [{ ...record(), id: 'INV-INVENTED' }] },
    { records: [{ ...record(), extra: true }] },
    { records: [Object.fromEntries(Object.entries(record()).filter(([key]) => key !== 'quantity'))] },
    { records: Array.from({ length: 51 }, record) }, null, [], { records: 'invalid' },
  ]) {
    await assert.rejects(extract(candidate), (error) => [422, 502].includes(error.status));
  }
});

test('invoice key absence is a friendly configuration error and never calls the model', async () => {
  await assert.rejects(extract({ records: [] }, { env: {}, fetchImpl: () => assert.fail('should not call model') }), (error) => error.status === 503 && /NEBIUS_API_KEY/.test(error.message));
});

test('extract route dispatches inventory and rejects unsupported kinds', async () => {
  const server = createServer({ env: { NEBIUS_API_KEY: 'key' }, fetchImpl: modelFetch({ records: [record()] }) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const [kind, status] of [['inventory', 200], ['invalid', 400]]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/extract`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, filename: 'invoice.txt', text }) });
      assert.equal(response.status, status);
      const result = await response.json();
      if (status === 200) assert.equal(result.records[0].source.name, 'invoice.txt');
    }
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('notice null JSON is a friendly model validation error and valid source name is pinned', async () => {
  const options = { filename: 'notice.txt', text, env: { NEBIUS_API_KEY: 'key' } };
  await assert.rejects(ai.extractNotice({ ...options, fetchImpl: modelFetch(null) }), (error) => error.status === 502 && /notice data/.test(error.message));
  const notice = { product: 'Sesame Bar', brand: 'Cedar', sku: 'S-1', upc: '001', lotCodes: ['L-7'], reason: '', date: '', instructions: '', source: { name: 'invented.txt', text }, confirmed: true, scopeNote: null };
  const result = await ai.extractNotice({ ...options, fetchImpl: modelFetch(notice) });
  assert.equal(result.notice.source.name, 'notice.txt');
  assert.equal(result.notice.confirmed, false);
});
