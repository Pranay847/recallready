import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCase } from '../server/demo.mjs';
import { STORAGE, restoreCase, currentAnalysis, sampleCase, withProvenance, provenanceLabel, canUseSampleNote, manualNotice } from '../src/case-state.mjs';

test('analysis belongs to its exact case revision, never a replacement sharing its ID', () => {
  const before = createDemoCase(), after = { ...before, records: [] };
  const result = { summary: { warehouseQuantity: 42 } };
  assert.equal(currentAnalysis({ caseData: before, analysis: result }, after), null);
  assert.equal(currentAnalysis({ caseData: before, analysis: result }, before), result);
});
test('changing source provenance exposes mixed sample and uploaded data', () => {
  const original = sampleCase(createDemoCase());
  assert.equal(provenanceLabel(original), 'Synthetic drill');
  const mixed = withProvenance(original, { notice: 'uploaded' });
  assert.equal(provenanceLabel(mixed), 'Mixed: includes synthetic data');
  assert.equal(mixed.mode, 'uploaded');
  assert.equal(canUseSampleNote(mixed, mixed.records[2]), false);
});
test('sample shortcut requires unchanged sample notice and inventory', () => {
  const original = sampleCase(createDemoCase());
  assert.equal(canUseSampleNote(original, original.records[2]), true);
  const changed = { ...original, notice: { ...original.notice, lotCodes: ['NEW-LOT'] } };
  assert.equal(canUseSampleNote(changed, changed.records[2]), false);
  const imported = { ...original, records: original.records.map((r,i) => i === 2 ? {...r, location:'Other site'} : r) };
  assert.equal(canUseSampleNote(imported, imported.records[2]), false);
});
test('manual notice carries the opened document with blank unconfirmed identifiers', () => {
  const notice = manualNotice('new-notice.txt', 'Fresh source evidence');
  assert.equal(notice.source.text, 'Fresh source evidence');
  assert.equal(notice.source.name, 'new-notice.txt');
  assert.equal(notice.sku, '');
  assert.deepEqual(notice.lotCodes, []);
  assert.equal(notice.confirmed, false);
});
test('malformed stored cases are backed up before the session may overwrite them', () => {
  const raw = JSON.stringify({ notice: {}, records: [], shipments: [] });
  const values = new Map([[STORAGE, raw]]);
  const storage = { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value) };
  const restored = restoreCase(storage);
  assert.equal(restored.caseData, null);
  assert.equal(restored.canPersist, true);
  assert.equal([...values].filter(([key,value]) => key.startsWith(`${STORAGE}.recovery.`) && value === raw).length, 1);
  assert.equal(values.get(STORAGE), raw);
});
test('failed backup disables persistence so malformed saved data is preserved', () => {
  const restored = restoreCase({ getItem: () => '{invalid', setItem: () => { throw new Error('Quota exceeded'); } });
  assert.equal(restored.caseData, null);
  assert.equal(restored.canPersist, false);
});
test('inaccessible browser storage is recovered without a render crash', () => {
  const restored = restoreCase(() => { throw new Error('Access denied'); });
  assert.equal(restored.caseData, null);
  assert.equal(restored.canPersist, false);
});
test('lazy browser storage access restores valid saved data', () => {
  const original = sampleCase(createDemoCase());
  const restored = restoreCase(() => ({ getItem: () => JSON.stringify(original) }));
  assert.equal(restored.caseData?.id, 'RR-2026-014');
});
test('valid saved samples retain provenance and data after restoration', () => {
  const original = sampleCase(createDemoCase());
  const restored = restoreCase({ getItem: () => JSON.stringify(original) });
  assert.deepEqual(restored.caseData.records, original.records);
  assert.equal(provenanceLabel(restored.caseData), 'Synthetic drill');
});
