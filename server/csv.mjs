const REQUIRED = {
  inventory: ['id', 'product', 'brand', 'sku', 'upc', 'lot', 'quantity', 'unit', 'location'],
  shipments: ['id', 'recordId', 'customer', 'quantity'],
};

function csvError(message) {
  throw new TypeError(`CSV ${message}`);
}

function parseRows(input) {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [];
  let cells = [];
  let value = '';
  let raw = '';
  let quoted = false;
  let afterQuote = false;
  let row = 1;
  let rowStart = 1;
  let fieldStart = true;

  const finishCell = () => {
    cells.push(value);
    value = '';
    fieldStart = true;
    afterQuote = false;
  };
  const finishRow = () => {
    finishCell();
    if (!(cells.length === 1 && cells[0] === '' && raw === '')) rows.push({ cells, raw, row: rowStart });
    cells = [];
    raw = '';
    rowStart = row + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      raw += char;
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          raw += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        value += char;
        if (char === '\n') row += 1;
      }
      continue;
    }
    if (afterQuote && char !== ',' && char !== '\n') csvError(`has characters after a closing quote at row ${row}`);
    if (char === '"') {
      if (!fieldStart) csvError(`has a malformed quote at row ${row}`);
      quoted = true;
      fieldStart = false;
      raw += char;
    } else if (char === ',') {
      raw += char;
      finishCell();
    } else if (char === '\n') {
      finishRow();
      row += 1;
    } else {
      value += char;
      raw += char;
      fieldStart = false;
    }
  }
  if (quoted) csvError(`has an unclosed quote at row ${rowStart}`);
  if (value !== '' || raw !== '' || cells.length > 0) finishRow();
  return rows;
}

function strictQuantity(value, row) {
  if (!/^\d+$/.test(value)) csvError(`quantity at row ${row} must be a nonnegative integer`);
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity)) csvError(`quantity at row ${row} must be a safe nonnegative integer`);
  return quantity;
}

export function importCsv(kind, filename, text) {
  if (!(kind in REQUIRED)) csvError('kind must be inventory or shipments');
  if (typeof filename !== 'string' || filename.trim() === '') csvError('filename is required');
  if (typeof text !== 'string') csvError('text must be a string');
  const rows = parseRows(text);
  if (rows.length === 0) csvError('is empty');
  const headers = rows[0].cells.map((header) => header.trim());
  const seenHeaders = new Set();
  for (const header of headers) {
    if (!header) csvError('contains an empty column name');
    if (seenHeaders.has(header)) csvError(`has duplicate column ${header}`);
    seenHeaders.add(header);
  }
  for (const required of REQUIRED[kind]) if (!seenHeaders.has(required)) csvError(`is missing required column ${required}`);
  const entities = [];
  const ids = new Set();
  for (const parsed of rows.slice(1)) {
    if (parsed.cells.length !== headers.length) csvError(`row ${parsed.row} has ${parsed.cells.length} columns; expected ${headers.length}`);
    const fields = Object.fromEntries(headers.map((header, index) => [header, parsed.cells[index].trim()]));
    if (!fields.id) csvError(`id at row ${parsed.row} is required`);
    if (ids.has(fields.id)) csvError(`has duplicate ${kind === 'inventory' ? 'record' : 'shipment'} id ${fields.id}`);
    ids.add(fields.id);
    const source = { name: filename, text: parsed.raw, row: parsed.row };
    if (kind === 'inventory') {
      for (const field of ['product', 'brand', 'sku', 'upc', 'lot', 'location']) if (fields[field] === undefined) csvError(`${field} at row ${parsed.row} must be text`);
      if (fields.unit !== 'cartons') csvError(`unit at row ${parsed.row} must be cartons`);
      entities.push({ id: fields.id, product: fields.product, brand: fields.brand, sku: fields.sku, upc: fields.upc, lot: fields.lot, quantity: strictQuantity(fields.quantity, parsed.row), unit: 'cartons', location: fields.location, source });
    } else {
      if (!fields.recordId || !fields.customer) csvError(`recordId and customer at row ${parsed.row} are required`);
      entities.push({ id: fields.id, recordId: fields.recordId, customer: fields.customer, quantity: strictQuantity(fields.quantity, parsed.row), source });
    }
  }
  return kind === 'inventory' ? { records: entities } : { shipments: entities };
}
