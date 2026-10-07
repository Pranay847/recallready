import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeCase, validateCase } from '../server/domain.mjs';
import { createDemoCase } from '../server/demo.mjs';

test('demo analysis matches the independently calculated initial drill', () => {
  const analysis = analyzeCase(createDemoCase());
  assert.deepEqual(analysis.summary, {
    affectedLots: 3,
    reviewLots: 1,
    excludedLots: 2,
    warehouseQuantity: 42,
    shippedQuantity: 52,
    affectedCustomers: 3,
    unknownQuantity: 12,
  });
  assert.equal(analysis.results.find(({ id }) => id === 'INV-103').status, 'review');
  assert.equal(analysis.results.find(({ id }) => id === 'INV-106').status, 'affected');
  assert.equal(analysis.results.find(({ id }) => id === 'INV-104').status, 'excluded');
});

test('operator resolution supplies evidence and produces the resolved drill totals', () => {
  const drill = createDemoCase();
  drill.resolutions['INV-103'] = {
    lot: 'CV-260801-02',
    source: 'Receiving note RN-448, checked by operator',
    confirmedAt: '2026-09-05T14:00:00.000Z',
  };
  const analysis = analyzeCase(drill);
  assert.deepEqual(analysis.summary, {
    affectedLots: 4,
    reviewLots: 0,
    excludedLots: 2,
    warehouseQuantity: 54,
    shippedQuantity: 60,
    affectedCustomers: 4,
    unknownQuantity: 0,
  });
  const resolved = analysis.results.find(({ id }) => id === 'INV-103');
  assert.equal(resolved.status, 'affected');
  assert.ok(resolved.evidence.some(({ name }) => name === 'Operator resolution'));
});

test('lot punctuation is meaningful and is never fuzzily cleared', () => {
  const drill = createDemoCase();
  drill.records[0].lot = 'CV26080101';
  const result = analyzeCase(drill).results.find(({ id }) => id === 'INV-101');
  assert.equal(result.status, 'excluded');
});

test('same UPC with a conflicting SKU is held for review', () => {
  const drill = createDemoCase();
  drill.records[0].sku = 'CV-OTHER-40';
  const result = analyzeCase(drill).results.find(({ id }) => id === 'INV-101');
  assert.equal(result.status, 'review');
});

test('unconfirmed notice holds every record for review before using notice identifiers', () => {
  const drill = createDemoCase();
  drill.notice.confirmed = false;
  assert.deepEqual(analyzeCase(drill).results.map(({ status }) => status), [
    'review', 'review', 'review', 'review', 'review', 'review',
  ]);
});

test('empty explicit lot list holds identity matches for review', () => {
  const drill = createDemoCase();
  drill.notice.lotCodes = [];
  const analysis = analyzeCase(drill);
  assert.equal(analysis.results.find(({ id }) => id === 'INV-101').status, 'review');
  assert.equal(analysis.results.find(({ id }) => id === 'INV-105').status, 'excluded');
});

test('incomplete or ambiguous identity is review rather than autonomous clearance', () => {
  const drill = createDemoCase();
  Object.assign(drill.records[0], { product: 'Sesame Snack', brand: '', sku: '', upc: '' });
  Object.assign(drill.records[1], { sku: 'CV-OTHER-40', upc: '' });
  const analysis = analyzeCase(drill);
  assert.equal(analysis.results.find(({ id }) => id === 'INV-101').status, 'review');
  assert.equal(analysis.results.find(({ id }) => id === 'INV-102').status, 'review');
});

test('exact brand and product can establish identity when record identifiers are absent', () => {
  const drill = createDemoCase();
  Object.assign(drill.records[0], { sku: '', upc: '' });
  const result = analyzeCase(drill).results.find(({ id }) => id === 'INV-101');
  assert.equal(result.status, 'affected');
});

test('validation rejects orphan shipments, repeated IDs, invalid quantities, and unknown resolutions', () => {
  const mutations = [
    [(drill) => { drill.shipments[0].recordId = 'NO-SUCH-RECORD'; }, /unknown record/i],
    [(drill) => { drill.records[1].id = drill.records[0].id; }, /duplicate record/i],
    [(drill) => { drill.shipments[1].id = drill.shipments[0].id; }, /duplicate shipment/i],
    [(drill) => { drill.records[0].quantity = -1; }, /quantity/i],
    [(drill) => { drill.shipments[0].quantity = Number.POSITIVE_INFINITY; }, /quantity/i],
    [(drill) => { drill.records[0].quantity = Number.MAX_SAFE_INTEGER + 1; }, /quantity/i],
    [(drill) => { drill.resolutions.UNKNOWN = { lot: 'X', source: 'note', confirmedAt: 'now' }; }, /unknown record/i],
    [(drill) => { drill.resolutions['INV-103'] = { lot: 'X', source: '', confirmedAt: 'now' }; }, /source/i],
    [(drill) => { drill.actions.UNKNOWN = true; }, /action.*unknown record/i],
    [(drill) => { drill.actions['INV-101'] = 'yes'; }, /action.*boolean/i],
    [(drill) => { drill.activity[0].text = 42; }, /activity/i],
    [(drill) => { drill.activity[0].at = 'not-a-date'; }, /activity/i],
  ];
  for (const [mutate, expected] of mutations) {
    const drill = createDemoCase();
    mutate(drill);
    assert.throws(() => validateCase(drill), expected);
  }
});
