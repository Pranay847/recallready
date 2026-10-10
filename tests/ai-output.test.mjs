import test from 'node:test';
import assert from 'node:assert/strict';
import { extractNotice, extractInventory } from '../server/ai.mjs';

const text = 'Harbor Mill Foods recalls Sesame Oat Bars, 40g, SKU HM-SES-40, lots HM-260901-A and HM-260901-B.';
const notice = {
  product: 'Sesame Oat Bars, 40g', brand: 'Harbor Mill Foods', sku: 'HM-SES-40', upc: '',
  lotCodes: ['HM-260901-A', 'HM-260901-B'], reason: '', date: '', instructions: '',
  source: { name: 'notice.txt', text }, confirmed: false, scopeNote: null,
};
const options = { filename: 'notice.txt', text, env: { NEBIUS_API_KEY: 'fixture-key' } };
const response = (content, extra = {}) => async () => new Response(JSON.stringify({
  choices: [{ finish_reason: extra.finishReason || 'stop', message: { content, refusal: extra.refusal } }],
}));

test('provider credit errors explain recovery without retries, candidates, or private provider details', async () => {
  for (const extract of [extractNotice, extractInventory]) {
    let calls = 0;
    await assert.rejects(extract({ ...options, fetchImpl: async () => {
      calls++;
      return new Response('private-provider-detail', { status: 402 });
    } }), error => error.status === 503 && /Token Factory balance/.test(error.message)
      && /sample drill/.test(error.message) && !error.message.includes('private-provider-detail'));
    assert.equal(calls, 1);
  }
});

test('both extraction prompts include the same complete schema as response_format', async () => {
  for (const [extract, candidate] of [[extractNotice, notice], [extractInventory, { records: [] }]]) {
    await extract({ ...options, fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      const prompt = body.messages[0].content;
      const schemaText = prompt.split('\nJSON Schema:\n')[1];
      assert.deepEqual(JSON.parse(schemaText), body.response_format.json_schema.schema);
      assert.match(prompt, /only one JSON object/);
      assert.match(prompt, /exact property names/);
      assert.match(body.messages[1].content, /UNTRUSTED DATA/);
      return response(JSON.stringify(candidate))();
    } });
  }
});

test('complete JSON inside a single Markdown fence still requires source verification and review', async () => {
  for (const language of ['json', '']) {
    const result = await extractNotice({ ...options, fetchImpl: response('```' + language + '\n' + JSON.stringify(notice) + '\n```') });
    assert.equal(result.pendingReview, true);
    assert.equal(result.notice.confirmed, false);
    assert.deepEqual(result.notice.lotCodes, notice.lotCodes);
  }
  const fabricated = { ...notice, source: { name: 'notice.txt', text: 'Invented evidence' } };
  await assert.rejects(extractNotice({ ...options, fetchImpl: response('```json\n' + JSON.stringify(fabricated) + '\n```') }), /source quote could not be verified/);
});

test('extraction never salvages malformed, partial, or ambiguous responses', async () => {
  for (const content of [undefined, '', null, {}, '{not json', 'Explanation: ' + JSON.stringify(notice), JSON.stringify(notice) + JSON.stringify(notice)]) {
    await assert.rejects(extractNotice({ ...options, fetchImpl: response(content) }), /malformed notice data/);
  }
  await assert.rejects(extractNotice({ ...options, fetchImpl: response(JSON.stringify({ quote: text, lot_codes: notice.lotCodes })) }), /invalid notice data/);
});

test('truncated and refused responses cannot be accepted even when their JSON is valid', async () => {
  await assert.rejects(extractNotice({ ...options, fetchImpl: response(JSON.stringify(notice), { finishReason: 'length' }) }), /cut short/);
  for (const extra of [{ refusal: 'Cannot comply' }, { finishReason: 'content_filter' }]) {
    await assert.rejects(extractNotice({ ...options, fetchImpl: response(JSON.stringify(notice), extra) }), /declined this document/);
  }
});
