import test from 'node:test';
import assert from 'node:assert/strict';

import { importCsv } from '../server/csv.mjs';

test('inventory CSV supports BOM, CRLF, quoted commas, and multiline source cells', () => {
  const text = '\uFEFFid,product,brand,sku,upc,lot,quantity,unit,location\r\nR-1,"Bar, Sesame",Cedar,SKU-1,123,L-1,7,cartons,"Aisle A\r\nupper shelf"\r\n';
  assert.deepEqual(importCsv('inventory', 'receiving.csv', text), {
    records: [{
      id: 'R-1', product: 'Bar, Sesame', brand: 'Cedar', sku: 'SKU-1', upc: '123',
      lot: 'L-1', quantity: 7, unit: 'cartons', location: 'Aisle A\nupper shelf',
      source: { name: 'receiving.csv', text: 'R-1,"Bar, Sesame",Cedar,SKU-1,123,L-1,7,cartons,"Aisle A\nupper shelf"', row: 2 },
    }],
  });
});

test('shipment CSV preserves provenance and parses strict integer quantities', () => {
  const text = 'id,recordId,customer,quantity\nS-1,R-1,"Market, North",12\n';
  assert.deepEqual(importCsv('shipments', 'shipments.csv', text), {
    shipments: [{
      id: 'S-1', recordId: 'R-1', customer: 'Market, North', quantity: 12,
      source: { name: 'shipments.csv', text: 'S-1,R-1,"Market, North",12', row: 2 },
    }],
  });
});

test('CSV import rejects malformed quotes, row width changes, duplicate columns and invalid quantity', () => {
  const fixtures = [
    ['inventory', 'id,product,brand,sku,upc,lot,quantity,unit,location\nR-1,"bad,Cedar,S,1,L,2,cartons,A', /quote/i],
    ['shipments', 'id,recordId,customer,quantity\nS-1,R-1,Market', /columns/i],
    ['shipments', 'id,recordId,customer,quantity,quantity\nS-1,R-1,Market,2,2', /duplicate column/i],
    ['inventory', 'id,product,brand,sku,upc,lot,quantity,unit,location\nR-1,Bar,Cedar,S,1,L,,cartons,A', /quantity/i],
    ['inventory', 'id,product,brand,sku,upc,lot,quantity,unit,location\nR-1,Bar,Cedar,S,1,L,2.5,cartons,A', /quantity/i],
    ['inventory', 'id,product,brand,sku,upc,lot,quantity,unit,location\nR-1,Bar,Cedar,S,1,L,-2,cartons,A', /quantity/i],
  ];
  for (const [kind, text, expected] of fixtures) {
    assert.throws(() => importCsv(kind, 'bad.csv', text), expected);
  }
});

test('CSV import rejects duplicate entity IDs and invalid unit values', () => {
  assert.throws(() => importCsv('shipments', 's.csv', 'id,recordId,customer,quantity\nS-1,R-1,A,1\nS-1,R-2,B,2\n'), /duplicate shipment/i);
  assert.throws(() => importCsv('inventory', 'i.csv', 'id,product,brand,sku,upc,lot,quantity,unit,location\nR-1,Bar,Cedar,S,1,L,2,pallets,A\n'), /unit/i);
});

test('CSV import rejects bad arguments, empty input, missing columns and stray characters after quotes', () => {
  const inventoryHeader = 'id,product,brand,sku,upc,lot,quantity,unit,location';
  assert.throws(() => importCsv('pallets', 'x.csv', 'id\n'), /kind must be/);
  assert.throws(() => importCsv('shipments', '  ', 'id\n'), /filename is required/);
  assert.throws(() => importCsv('shipments', 'x.csv', null), /text must be a string/);
  assert.throws(() => importCsv('shipments', 'x.csv', '﻿'), /is empty/);
  assert.throws(() => importCsv('shipments', 'x.csv', 'id,recordId,,quantity\n'), /empty column name/);
  assert.throws(() => importCsv('shipments', 'x.csv', 'id,recordId,quantity\n'), /missing required column customer/);
  assert.throws(() => importCsv('inventory', 'x.csv', `${inventoryHeader}\nR-1,"Bar"x,Cedar,S,1,L,2,cartons,A`), /after a closing quote at row 2/);
  assert.throws(() => importCsv('inventory', 'x.csv', `${inventoryHeader}\nR-1,Bar,Cedar,S,1,L,9007199254740992,cartons,A`), /safe nonnegative integer/);
  assert.throws(() => importCsv('shipments', 'x.csv', 'id,recordId,customer,quantity\n ,R-1,A,1'), /id at row 2 is required/);
  assert.throws(() => importCsv('shipments', 'x.csv', 'id,recordId,customer,quantity\nS-1,R-1, ,1'), /recordId and customer at row 2/);
});

test('CSV import skips blank lines, tolerates extra columns, and reports rows after multiline cells', () => {
  const text = 'id,recordId,customer,quantity,note\n\nS-1,R-1,A,1,"two\nlines"\n\n';
  const { shipments } = importCsv('shipments', 's.csv', text);
  assert.equal(shipments.length, 1);
  assert.equal(shipments[0].source.row, 3);
  assert.equal('note' in shipments[0], false);
  assert.throws(() => importCsv('shipments', 's.csv', `${text}S-2,R-1,B,x,\n`), /quantity at row 6/);
});
