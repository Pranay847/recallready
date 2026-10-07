import { validateCase } from '../server/domain.mjs';

export const STORAGE = 'recallready.case.v1';
const layers = ['notice', 'inventory', 'shipments'];
const origins = ['sample', 'uploaded', 'empty', 'unknown'];

export function provenanceOf(data) {
  return Object.fromEntries(layers.map(layer => [layer, data.provenance?.[layer] || 'unknown']));
}

export function provenanceLabel(data) {
  const active = Object.values(provenanceOf(data)).filter(value => value !== 'empty');
  if (active.length && active.every(value => value === 'sample')) return 'Synthetic drill';
  if (active.includes('sample')) return 'Mixed: includes synthetic data';
  if (active.includes('unknown')) return 'Provenance unconfirmed';
  return active.length ? 'Uploaded records' : 'Empty workspace';
}

export function withProvenance(data, change = {}) {
  const provenance = { ...provenanceOf(data), ...change };
  const next = { ...data, provenance };
  return { ...next, mode: provenanceLabel(next) === 'Synthetic drill' ? 'sample' : 'uploaded' };
}

export function sampleCase(data) {
  return { ...withProvenance(data, { notice: 'sample', inventory: 'sample', shipments: 'sample' }), sampleFixture: { notice: JSON.stringify(data.notice), inventory: JSON.stringify(data.records) } };
}

export function canUseSampleNote(data, record) {
  const provenance = provenanceOf(data);
  return record?.id === 'INV-103' && record.lot === '' && record.quantity === 12 && record.sku === 'CV-SES-40' && record.upc === '00012345678905' &&
    provenance.notice === 'sample' && provenance.inventory === 'sample' &&
    data.sampleFixture?.notice === JSON.stringify(data.notice) && data.sampleFixture?.inventory === JSON.stringify(data.records);
}

export function manualNotice(filename, text) {
  return { product: '', brand: '', sku: '', upc: '', lotCodes: [], reason: '', date: '', instructions: '', source: { name: filename || 'Manual notice', text }, confirmed: false };
}

export function currentAnalysis(snapshot, data) {
  return snapshot?.caseData === data ? snapshot.analysis : null;
}

export function restoreCase(storage) {
  let raw;
  try { if (typeof storage === 'function') storage = storage(); raw = storage.getItem(STORAGE); } catch { return { caseData: null, warning: 'Browser storage is unavailable. This session cannot be saved.', canPersist: false }; }
  if (!raw) return { caseData: null, warning: '', canPersist: true };
  try {
    const value = validateCase(JSON.parse(raw));
    if (value.provenance && (typeof value.provenance !== 'object' || layers.some(layer => !origins.includes(value.provenance[layer])))) throw new Error('Invalid provenance');
    if (value.sampleFixture && (typeof value.sampleFixture.notice !== 'string' || typeof value.sampleFixture.inventory !== 'string')) throw new Error('Invalid sample fixture');
    return { caseData: withProvenance(value), warning: '', canPersist: true };
  } catch {
    try {
      const key = `${STORAGE}.recovery.${Date.now()}`;
      storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw new Error('Backup could not be verified');
      return { caseData: null, warning: 'The saved case could not be read. Its original contents were preserved in a browser recovery backup; a fresh sample is open.', canPersist: true };
    } catch {
      return { caseData: null, warning: 'The saved case could not be read or backed up. Its original contents are preserved; this session will not overwrite them.', canPersist: false };
    }
  }
}
