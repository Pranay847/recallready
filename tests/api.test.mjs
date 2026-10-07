import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';

import { createServer } from '../server/index.mjs';
import { createDemoCase } from '../server/demo.mjs';

async function withServer(options, run) {
  const server = createServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function jsonRequest(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  return { response, body: await response.json() };
}

function makePdf(text) {
  const escaped = text.replace(/([\\()])/g, '\\$1');
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf).toString('base64');
}

test('health reports configuration without exposing the API key', async () => {
  await withServer({ env: { NEBIUS_API_KEY: 'top-secret', NEBIUS_MODEL: 'fixture-model' } }, async (base) => {
    const { response, body } = await jsonRequest(base, '/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { aiConfigured: true, model: 'fixture-model' });
    assert.equal(JSON.stringify(body).includes('top-secret'), false);
  });
});

test('local server rejects non-loopback Host headers', async () => {
  await withServer({}, async base => {
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(`${base}/api/health`, { headers: { Host: 'untrusted.example' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
      request.on('error', reject); request.end();
    });
    assert.equal(status, 403);
  });
});

test('demo and analysis routes exercise the real deterministic runtime', async () => {
  await withServer({}, async (base) => {
    const demo = await jsonRequest(base, '/api/demo');
    assert.equal(demo.response.status, 200);
    assert.equal(demo.body.case.id, 'RR-2026-014');
    const analysis = await jsonRequest(base, '/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ case: demo.body.case }),
    });
    assert.equal(analysis.response.status, 200);
    assert.deepEqual(analysis.body.summary, {
      affectedLots: 3, reviewLots: 1, excludedLots: 2, warehouseQuantity: 42,
      shippedQuantity: 52, affectedCustomers: 3, unknownQuantity: 12,
    });
  });
});

test('mutation routes reject foreign origins and return friendly validation errors', async () => {
  await withServer({}, async (base) => {
    const foreign = await jsonRequest(base, '/api/analyze', {
      method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(foreign.response.status, 403);
    assert.equal(typeof foreign.body.error, 'string');

    const drill = createDemoCase();
    drill.shipments[0].recordId = 'UNKNOWN';
    const invalid = await jsonRequest(base, '/api/analyze', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ case: drill }),
    });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.body.error, /unknown record/i);
  });
});

test('import route parses records and rejects missing quantities', async () => {
  await withServer({}, async (base) => {
    const valid = await jsonRequest(base, '/api/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'shipments', filename: 'shipments.csv', text: 'id,recordId,customer,quantity\nS-9,R-1,North Shop,4\n' }),
    });
    assert.equal(valid.response.status, 200);
    assert.equal(valid.body.shipments[0].quantity, 4);
    assert.equal(valid.body.shipments[0].source.row, 2);

    const invalid = await jsonRequest(base, '/api/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'shipments', filename: 'shipments.csv', text: 'id,recordId,customer,quantity\nS-9,R-1,North Shop,\n' }),
    });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.body.error, /quantity/i);
  });
});

test('extract returns 503 with no fallback or usage when AI is not configured', async () => {
  await withServer({ env: {} }, async (base) => {
    const { response, body } = await jsonRequest(base, '/api/extract', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'notice.txt', text: 'Recall lot L-1.' }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(Object.keys(body), ['error']);
  });
});

test('document route extracts text PDFs and clearly rejects image-only PDFs', async () => {
  await withServer({}, async (base) => {
    const readable = await jsonRequest(base, '/api/document', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'notice.pdf', dataBase64: makePdf('Recall lot L-1.') }),
    });
    assert.equal(readable.response.status, 200);
    assert.equal(readable.body.pages, 1);
    assert.match(readable.body.text, /Recall lot L-1/);

    const imageOnly = await jsonRequest(base, '/api/document', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'scan.pdf', dataBase64: makePdf('') }),
    });
    assert.equal(imageOnly.response.status, 400);
    assert.match(imageOnly.body.error, /image-only/i);
  });
});

test('extract sends a strict schema request and returns an unconfirmed candidate with real usage', async () => {
  let requestBody;
  const fixtureNotice = {
    product: 'Sesame Bar', brand: 'Cedar Valley Foods', sku: 'CV-1', upc: '001', lotCodes: ['L-1'],
    reason: 'Undeclared peanut', date: '2026-09-03', instructions: 'Hold product',
    source: { name: 'notice.txt', text: 'Cedar Valley Foods recalls Sesame Bar lot L-1.' }, confirmed: true,
  };
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(fixtureNotice) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 111, completion_tokens: 45, total_tokens: 156 },
      model: 'fixture-model',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await withServer({ env: { NEBIUS_API_KEY: 'key', NEBIUS_MODEL: 'fixture-model' }, fetchImpl }, async (base) => {
    const { response, body } = await jsonRequest(base, '/api/extract', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'notice.txt', text: 'Cedar Valley Foods recalls Sesame Bar lot L-1. Hold product.' }),
    });
    assert.equal(response.status, 200);
    assert.equal(body.notice.confirmed, false);
    assert.equal(body.notice.product, 'Sesame Bar');
    assert.equal(body.pendingReview, true);
    assert.deepEqual(body.usage.promptTokens, 111);
    assert.deepEqual(body.usage.completionTokens, 45);
    assert.equal(requestBody.response_format.type, 'json_schema');
    assert.equal(requestBody.response_format.json_schema.strict, true);
    assert.match(requestBody.messages[1].content, /untrusted data/i);
  });
});

test('extract rejects malformed model output and source text not present in the document', async () => {
  const responses = [
    { choices: [{ message: { content: '{not json' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
    { choices: [{ message: { content: JSON.stringify({ product: 'Bar', brand: 'Cedar', sku: 'S', upc: '1', lotCodes: ['L-1'], reason: 'reason', date: '2026', instructions: 'hold', source: { name: 'notice.txt', text: 'invented quote' }, confirmed: false }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
  ];
  for (const fixture of responses) {
    await withServer({
      env: { NEBIUS_API_KEY: 'key' },
      fetchImpl: async () => new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } }),
    }, async (base) => {
      const { response, body } = await jsonRequest(base, '/api/extract', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: 'notice.txt', text: 'Real recall text lot L-1.' }),
      });
      assert.ok(response.status >= 400);
      assert.deepEqual(Object.keys(body), ['error']);
    });
  }
});
