const normalize = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US') : '';
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

function fail(message) {
  throw new TypeError(message);
}

function validateSource(source, field) {
  if (!source || !hasText(source.name) || typeof source.text !== 'string') fail(`${field} source is invalid`);
  if (source.row !== undefined && (!Number.isInteger(source.row) || source.row < 1)) fail(`${field} source row is invalid`);
}

function validateQuantity(quantity, field) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) fail(`${field} quantity must be a nonnegative safe integer`);
}

export function validateNotice(notice) {
  if (!notice || typeof notice !== 'object') fail('notice is required');
  for (const field of ['product', 'brand', 'sku', 'upc', 'reason', 'date', 'instructions']) {
    if (typeof notice[field] !== 'string') fail(`notice ${field} must be text`);
  }
  if (!Array.isArray(notice.lotCodes) || notice.lotCodes.some((lot) => typeof lot !== 'string')) fail('notice lotCodes must be a list of text values');
  if (typeof notice.confirmed !== 'boolean') fail('notice confirmed must be boolean');
  if (notice.scopeNote !== undefined && typeof notice.scopeNote !== 'string') fail('notice scopeNote must be text');
  validateSource(notice.source, 'notice');
  return notice;
}

export function validateCase(value) {
  if (!value || typeof value !== 'object') fail('case is required');
  for (const field of ['id', 'title', 'organization']) if (!hasText(value[field])) fail(`case ${field} is required`);
  if (!['sample', 'uploaded'].includes(value.mode)) fail('case mode is invalid');
  validateNotice(value.notice);
  if (!Array.isArray(value.records) || !Array.isArray(value.shipments)) fail('case records and shipments must be lists');
  const recordIds = new Set();
  for (const record of value.records) {
    if (!record || !hasText(record.id)) fail('record id is required');
    if (recordIds.has(record.id)) fail(`duplicate record id: ${record.id}`);
    recordIds.add(record.id);
    for (const field of ['product', 'brand', 'sku', 'upc', 'lot', 'location']) if (typeof record[field] !== 'string') fail(`record ${record.id} ${field} must be text`);
    if (record.unit !== 'cartons') fail(`record ${record.id} unit must be cartons`);
    validateQuantity(record.quantity, `record ${record.id}`);
    validateSource(record.source, `record ${record.id}`);
  }
  const shipmentIds = new Set();
  for (const shipment of value.shipments) {
    if (!shipment || !hasText(shipment.id)) fail('shipment id is required');
    if (shipmentIds.has(shipment.id)) fail(`duplicate shipment id: ${shipment.id}`);
    shipmentIds.add(shipment.id);
    if (!recordIds.has(shipment.recordId)) fail(`shipment ${shipment.id} targets unknown record ${shipment.recordId}`);
    if (!hasText(shipment.customer)) fail(`shipment ${shipment.id} customer is required`);
    validateQuantity(shipment.quantity, `shipment ${shipment.id}`);
    validateSource(shipment.source, `shipment ${shipment.id}`);
  }
  if (!value.resolutions || typeof value.resolutions !== 'object' || Array.isArray(value.resolutions)) fail('case resolutions must be an object');
  for (const [recordId, resolution] of Object.entries(value.resolutions)) {
    if (!recordIds.has(recordId)) fail(`resolution targets unknown record ${recordId}`);
    if (!resolution || !hasText(resolution.lot) || !hasText(resolution.source) || !hasText(resolution.confirmedAt)) fail(`resolution ${recordId} needs a lot, source, and confirmedAt`);
  }
  if (!value.actions || typeof value.actions !== 'object' || Array.isArray(value.actions)) fail('case actions must be an object');
  for (const [recordId, completed] of Object.entries(value.actions)) {
    if (!recordIds.has(recordId)) fail(`action targets unknown record ${recordId}`);
    if (typeof completed !== 'boolean') fail(`action ${recordId} must be boolean`);
  }
  if (!Array.isArray(value.activity)) fail('case activity must be a list');
  const activityIds = new Set();
  for (const activity of value.activity) {
    if (!activity || !hasText(activity.id) || !hasText(activity.text) || !hasText(activity.at) || Number.isNaN(Date.parse(activity.at))) fail('activity entries need a valid id, text, and date');
    if (activityIds.has(activity.id)) fail(`duplicate activity id: ${activity.id}`);
    activityIds.add(activity.id);
  }
  return value;
}

function identityStatus(record, notice) {
  const recordUpc = normalize(record.upc);
  const noticeUpc = normalize(notice.upc);
  const recordSku = normalize(record.sku);
  const noticeSku = normalize(notice.sku);
  const upcComparable = Boolean(recordUpc && noticeUpc);
  const skuComparable = Boolean(recordSku && noticeSku);

  if (upcComparable && recordUpc === noticeUpc) {
    if (skuComparable && recordSku !== noticeSku) return ['review', 'UPC matches, but SKU conflicts'];
    return ['match', 'Exact UPC match'];
  }
  if (skuComparable && recordSku === noticeSku) {
    if (upcComparable && recordUpc !== noticeUpc) return ['review', 'SKU matches, but UPC conflicts'];
    return ['match', 'Exact SKU match'];
  }
  if (upcComparable && recordUpc !== noticeUpc) return ['excluded', 'UPC does not match the notice'];
  if (skuComparable && recordSku !== noticeSku) return ['review', 'SKU differs and no UPC comparison can safely establish identity'];

  const product = normalize(record.product);
  const noticeProduct = normalize(notice.product);
  const brand = normalize(record.brand);
  const noticeBrand = normalize(notice.brand);
  if (product && noticeProduct && product === noticeProduct && brand && noticeBrand && brand === noticeBrand) return ['match', 'Exact brand and product match'];
  if (brand && noticeBrand && brand === noticeBrand && product && noticeProduct) return ['review', 'Product name is ambiguous'];
  return ['review', 'Product identity is incomplete or ambiguous'];
}

function analyzeRecord(record, notice, resolution, shipments) {
  const evidence = [notice.source, record.source];
  if (resolution) evidence.push({ name: 'Operator resolution', text: resolution.source });
  if (!notice.confirmed) return { id: record.id, status: 'review', reason: 'Recall notice must be confirmed before analysis', matchedOn: 'unconfirmed notice', evidence, shipments };
  const [identity, identityReason] = identityStatus(record, notice);
  if (identity === 'excluded') return { id: record.id, status: 'excluded', reason: identityReason, matchedOn: 'identity', evidence, shipments };
  if (identity === 'review') return { id: record.id, status: 'review', reason: identityReason, matchedOn: 'identity conflict', evidence, shipments };
  if (notice.lotCodes.length === 0 || notice.lotCodes.some((lot) => !hasText(lot))) return { id: record.id, status: 'review', reason: 'No complete explicit lot list is available', matchedOn: identityReason, evidence, shipments };
  const lot = resolution?.lot ?? record.lot;
  if (!hasText(lot)) return { id: record.id, status: 'review', reason: 'Lot code is missing', matchedOn: identityReason, evidence, shipments };
  const found = notice.lotCodes.some((candidate) => normalize(candidate) === normalize(lot));
  return found
    ? { id: record.id, status: 'affected', reason: 'Exact lot code appears in the confirmed notice', matchedOn: `${identityReason}; exact lot`, evidence, shipments }
    : { id: record.id, status: 'excluded', reason: 'Known lot is outside the complete explicit notice list', matchedOn: `${identityReason}; exact lot`, evidence, shipments };
}

export function analyzeCase(value) {
  const startedAt = performance.now();
  const recallCase = validateCase(value);
  const shipmentsByRecord = new Map(recallCase.records.map(({ id }) => [id, []]));
  for (const shipment of recallCase.shipments) shipmentsByRecord.get(shipment.recordId).push(shipment);
  const results = recallCase.records.map((record) => analyzeRecord(record, recallCase.notice, recallCase.resolutions[record.id], shipmentsByRecord.get(record.id)));
  const byId = new Map(recallCase.records.map((record) => [record.id, record]));
  const affected = results.filter(({ status }) => status === 'affected');
  const review = results.filter(({ status }) => status === 'review');
  const affectedShipments = affected.flatMap(({ shipments }) => shipments);
  const summary = {
    affectedLots: affected.length,
    reviewLots: review.length,
    excludedLots: results.filter(({ status }) => status === 'excluded').length,
    warehouseQuantity: affected.reduce((sum, { id }) => sum + byId.get(id).quantity, 0),
    shippedQuantity: affectedShipments.reduce((sum, shipment) => sum + shipment.quantity, 0),
    affectedCustomers: new Set(affectedShipments.map(({ customer }) => normalize(customer))).size,
    unknownQuantity: review.reduce((sum, { id }) => sum + byId.get(id).quantity, 0),
  };
  return { results, summary, durationMs: Math.max(0, Math.round(performance.now() - startedAt)) };
}
