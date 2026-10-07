import { provenanceOf, provenanceLabel } from './case-state.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const label = status => ({ affected: 'Affected', review: 'Needs verification', excluded: 'Outside this recall' }[status] || 'Needs verification');
const effectiveLot = (data, row) => data.resolutions?.[row.id]?.lot || row.lot || 'Not recorded';
const sourceHtml = source => `<div class="source"><strong>${escape(source.name)}${source.row ? ` · row ${escape(source.row)}` : ''}</strong><pre>${escape(source.text)}</pre></div>`;
const holdStatus = (data, result) => result.status === 'affected' && data.actions?.[result.id] === true ? (data.mode === 'sample' ? 'Practice hold recorded' : 'Operator hold recorded') : 'No hold confirmation';

export function customerGroups(results) {
  const groups = new Map();
  for (const result of results.filter(r => r.status === 'affected')) {
    for (const shipment of result.shipments) {
      const key = shipment.customer.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
      const group = groups.get(key) || { name: shipment.customer.trim(), quantity: 0, records: new Set(), shipments: [] };
      group.quantity += shipment.quantity;
      group.records.add(result.id);
      group.shipments.push(shipment);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

export function exportReport(data, analysis, reviewed = false) {
  const byId = new Map(data.records.map(row => [row.id, row]));
  const generated = new Date().toISOString();
  const summary = analysis.summary;
  const provenance = provenanceOf(data);
  const origin = provenanceLabel(data);
  const rows = analysis.results.map(result => {
    const row = byId.get(result.id);
    if (!row) throw new Error('Analysis does not match the current inventory. Run the trace again.');
    return `<tr><td><strong>${escape(row.id)}</strong><br>${escape(row.product)}</td><td>${escape(effectiveLot(data,row))}</td><td>${escape(row.location)}</td><td>${row.quantity}</td><td><span class="status ${escape(result.status)}">${label(result.status)}</span></td><td>${holdStatus(data,result)}</td></tr>`;
  }).join('');
  const evidence = analysis.results.map(result => {
    const row = byId.get(result.id);
    const resolution = data.resolutions?.[row.id];
    return `<article><h3>${escape(row.id)} · ${label(result.status)}</h3><p>${escape(result.reason)}</p><p>Effective lot: <strong>${escape(effectiveLot(data,row))}</strong>. ${row.quantity} cartons currently in warehouse.</p>${resolution ? `<p>Operator verification: ${escape(resolution.source)}<br><small>Recorded ${escape(resolution.confirmedAt)}</small></p>` : ''}${result.evidence.map(sourceHtml).join('')}${result.shipments.length ? `<h4>Linked shipments${result.status === 'review' ? ' — determination unresolved' : ''}</h4><table><thead><tr><th>Shipment</th><th>Customer</th><th>Cartons</th></tr></thead><tbody>${result.shipments.map(s => `<tr><td>${escape(s.id)}</td><td>${escape(s.customer)}</td><td>${s.quantity}</td></tr>`).join('')}</tbody></table>${result.shipments.map(s => sourceHtml(s.source)).join('')}` : '<p>No linked shipment records.</p>'}</article>`;
  }).join('');
  const drafts = customerGroups(analysis.results).map(customer => `<article><h3>${escape(customer.name)} · ${customer.quantity} cartons</h3><p><strong>Draft only — not sent</strong></p><p>Please review your receipt of ${escape(data.notice.product)} from ${escape(data.notice.brand)}. Our shipment records link ${customer.quantity} cartons to the lots listed in the recall notice. Please follow the supplier’s instructions and confirm the quantities you can account for.</p><p>Supplier instructions: ${escape(data.notice.instructions)}</p><p>Linked inventory records: ${escape([...customer.records].join(', '))}</p></article>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(data.id)} — RecallReady response packet</title><style>
*{box-sizing:border-box}body{font:14px/1.65 'Segoe UI',Arial,sans-serif;color:#294b55;max-width:1100px;margin:40px auto;padding:0 24px}header{border-bottom:3px solid #087e83;padding-bottom:22px}h1{font-size:32px;line-height:1.2;letter-spacing:-1px;margin:14px 0}h2{font-size:22px;margin:36px 0 16px}h3{font-size:16px;margin:0 0 10px}h4{margin-bottom:12px}p{max-width:90ch}.brand{color:#087e83;font-weight:700;letter-spacing:-.5px}.meta,small{color:#617f89;font-size:12px}.notice{background:#edf5f3;border:1px solid #d2e4df;border-radius:8px;padding:18px;margin:24px 0}.warning{background:#fff6e7;border:1px solid #e8d7b4;color:#79571e;padding:16px;border-radius:8px}.summary{display:flex;gap:28px;flex-wrap:wrap;margin:26px 0}.summary strong{font-size:29px;display:block;color:#245c62}.summary span{font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px;margin:15px 0}th{text-align:left;background:#f2f6f6}th,td{border:1px solid #dae5e7;padding:10px;vertical-align:top;overflow-wrap:anywhere}.status{font-size:11px;padding:3px 6px;border-radius:4px;white-space:nowrap}.affected{color:#9f5552;background:#fbefed}.review{color:#936315;background:#fcf1db}.excluded{color:#4d7869;background:#edf5f0}article{border:1px solid #dce6e8;padding:21px;margin:17px 0;border-radius:8px;break-inside:avoid}.source{background:#f6f8f9;padding:13px;margin:13px 0;border-radius:5px;font-size:12px}.source pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 'Segoe UI',Arial,sans-serif;margin-bottom:0}li{margin:10px 0}footer{border-top:1px solid #dce6e8;margin-top:35px;padding:18px 0;font-size:11px;color:#65808a}@media print{body{margin:0;max-width:none;padding:0;font-size:11px}h2{break-after:avoid}thead{display:table-header-group}.summary strong{font-size:24px}}@media(max-width:650px){body{margin-top:24px;padding:0 14px}table{font-size:10px}th,td{padding:6px}.status{white-space:normal}}
</style></head><body><header><div class="brand">RecallReady</div><h1>${escape(data.title)}</h1><div class="meta">${escape(data.organization)} · ${escape(data.id)}<br>Generated ${escape(generated)} · ${reviewed ? 'Reviewed by operator' : 'Draft for operator review'}</div></header>
<div class="${origin === 'Uploaded records' ? 'notice' : 'warning'}"><strong>${escape(origin)}.</strong> ${origin === 'Synthetic drill' ? 'All sample products, organizations, and records are fictional. Hold confirmations are practice actions.' : 'Hold confirmations are operator statements based on the records in this packet.'} No warehouse system has been updated and no customer messages have been sent.<br><small>Notice: ${escape(provenance.notice)} · Inventory: ${escape(provenance.inventory)} · Shipments: ${escape(provenance.shipments)}</small></div>
<div class="summary"><div><strong>${summary.warehouseQuantity}</strong><span>Affected warehouse cartons</span></div><div><strong>${summary.shippedQuantity}</strong><span>Affected dispatched cartons</span></div><div><strong>${summary.affectedCustomers}</strong><span>Customers to contact</span></div><div><strong>${summary.reviewLots}</strong><span>Records needing verification</span></div></div>
${summary.reviewLots ? '<div class="warning">Unresolved records and their linked shipments are included in the evidence section. They are excluded from the confirmed affected totals above; their status is not a clearance.</div>' : ''}
<h2>Recall scope</h2><div class="notice"><strong>${escape(data.notice.product)}</strong><p>Brand: ${escape(data.notice.brand)}<br>SKU: ${escape(data.notice.sku || 'Not provided')} · UPC: ${escape(data.notice.upc || 'Not provided')}<br>Affected lots: ${escape(data.notice.lotCodes.join(', ') || 'Not specified')}<br>Reason: ${escape(data.notice.reason)}<br>Supplier instructions: ${escape(data.notice.instructions)}<br>Scope ${data.notice.confirmed ? 'confirmed by operator' : 'not confirmed'}.</p></div>${sourceHtml(data.notice.source)}
<h2>Inventory determinations</h2><table><thead><tr><th>Record / product</th><th>Effective lot</th><th>Location</th><th>Warehouse cartons</th><th>Determination</th><th>Recorded action</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Evidence and linked shipments</h2>${evidence || '<p>No inventory records.</p>'}
<h2>Customer contact drafts</h2>${drafts || '<p>No confirmed affected customer shipments.</p>'}
<h2>Verification history</h2><ol>${(data.activity || []).map(a => `<li>${escape(a.text)}<br><small>${escape(a.at)}</small></li>`).join('') || '<li>No recorded verification actions.</li>'}</ol>
<footer>RecallReady early build. Exact product and lot-list checks only. Determinations depend on the completeness and correctness of the supplied records and confirmed recall scope. This packet is an operator review aid.</footer></body></html>`;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportManifest(data, analysis) {
  const headers = ['record_id','product','brand','sku','upc','effective_lot','warehouse_cartons','location','determination','reason','recorded_action','verification_source','source_provenance'];
  const byId = new Map(data.records.map(row => [row.id,row]));
  const rows = analysis.results.map(result => {
    const row = byId.get(result.id);
    if (!row) throw new Error('Analysis does not match the current inventory. Run the trace again.');
    return [row.id,row.product,row.brand,row.sku,row.upc,effectiveLot(data,row),row.quantity,row.location,label(result.status),result.reason,holdStatus(data,result),data.resolutions?.[row.id]?.source || '',provenanceOf(data).inventory];
  });
  return '\uFEFF' + [headers,...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
