import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { importCsv } from '../server/csv.mjs';
import { createDemoCase } from '../server/demo.mjs';
import { analyzeCase } from '../server/domain.mjs';

test('downloadable sample CSV files reproduce the hand-calculated initial drill', async () => {
  const [inventoryText, shipmentText] = await Promise.all([
    readFile(new URL('../public/samples/inventory.csv', import.meta.url), 'utf8'),
    readFile(new URL('../public/samples/shipments.csv', import.meta.url), 'utf8'),
  ]);
  const drill = createDemoCase();
  drill.records = importCsv('inventory', 'inventory.csv', inventoryText).records;
  drill.shipments = importCsv('shipments', 'shipments.csv', shipmentText).shipments;
  assert.deepEqual(analyzeCase(drill).summary, {
    affectedLots: 3,
    reviewLots: 1,
    excludedLots: 2,
    warehouseQuantity: 42,
    shippedQuantity: 52,
    affectedCustomers: 3,
    unknownQuantity: 12,
  });
});
