import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Boxes, Check, CheckCheck, ChevronRight, CircleHelp, ClipboardCheck, Download, FileCheck2, FileText, FolderInput, LayoutDashboard, ListFilter, LoaderCircle, MapPin, Package, PackageCheck, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Truck, Upload, X, AlertTriangle, CircleCheck, ExternalLink } from 'lucide-react';
import { Button, Status, Modal, SourceCard, Empty, CartonArt } from './components.jsx';
import { exportReport, exportManifest, customerGroups } from './exports.mjs';
import { STORAGE, restoreCase, currentAnalysis, sampleCase, withProvenance, provenanceOf, provenanceLabel, canUseSampleNote, manualNotice } from './case-state.mjs';
import InvoiceIntake from './InvoiceIntake.jsx';
import AiConnection from './AiConnection.jsx';

const pages = [
  { id: 'overview', label: 'Recall overview', icon: LayoutDashboard },
  { id: 'records', label: 'Source records', icon: FolderInput },
  { id: 'evidence', label: 'Evidence queue', icon: ShieldCheck },
  { id: 'response', label: 'Response packet', icon: ClipboardCheck },
];
const emptySummary = { affectedLots: 0, reviewLots: 0, excludedLots: 0, warehouseQuantity: 0, shippedQuantity: 0, affectedCustomers: 0, unknownQuantity: 0 };
async function api(path, data, signal, accessCode = '') {
  const headers = { 'Content-Type': 'application/json', ...((path === 'extract' || path === 'access') && accessCode ? { 'X-Demo-Access-Code': accessCode } : {}) };
  const response = await fetch(`/api/${path}`, data === undefined ? { signal } : { method: 'POST', headers, body: JSON.stringify(data), signal });
  let json;
  try { json = await response.json(); } catch { throw new Error('The workspace server is unavailable. Start the server and try again.'); }
  if (!response.ok) throw new Error(json.error || 'The request could not be completed.');
  return json;
}
const event = text => ({ id: crypto.randomUUID(), text, at: new Date().toISOString() });
const download = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function App() {
  const [restored] = useState(() => restoreCase(() => window.localStorage));
  const [caseData, setCase] = useState(restored.caseData);
  const [analysisSnapshot, setAnalysisSnapshot] = useState(null);
  const analysis = currentAnalysis(analysisSnapshot, caseData);
  const [analyzing, setAnalyzing] = useState(true);
  const [health, setHealth] = useState(null);
  const [accessCode, setAccessCode] = useState('');
  const apiWithAccess = (path, data, signal) => api(path, data, signal, accessCode);
  const [page, setPage] = useState('overview');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [reviewedCase, setReviewedCase] = useState(null);
  const reviewed = reviewedCase === caseData;
  const setReviewed = value => setReviewedCase(value ? caseData : null);
  const [navOpen, setNavOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api('health').then(result => { if (active) setHealth(result); }).catch(() => {});
    if (!caseData) api('demo').then(result => { if (active) setCase(sampleCase(result.case)); }).catch(e => { if (active) { setError(e.message); setAnalyzing(false); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!caseData) return;
    const controller = new AbortController();
    setAnalyzing(true); setError(''); setReviewed(false);
    try { if (restored.canPersist) localStorage.setItem(STORAGE, JSON.stringify(caseData)); } catch { setToast('Your browser could not save this case. Keep this tab open and export your response.'); }
    api('analyze', { case: caseData }, controller.signal).then(result => { if (!controller.signal.aborted) setAnalysisSnapshot({ caseData, analysis: result }); }).catch(e => { if (!controller.signal.aborted && e.name !== 'AbortError') { setError(e.message); setAnalysisSnapshot(null); } }).finally(() => { if (!controller.signal.aborted) setAnalyzing(false); });
    return () => controller.abort();
  }, [caseData, retry]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); } }, [toast]);
  const summary = analysis?.summary || emptySummary;
  const results = analysis?.results || [];
  const update = (change, text) => setCase(current => ({ ...current, ...change, activity: [...(current.activity || []), event(text)] }));
  const navigate = id => { setPage(id); setNavOpen(false); setQuery(''); setFilter('all'); };
  const resolve = (recordId, lot, source) => {
    update({ resolutions: { ...caseData.resolutions, [recordId]: { lot: lot.trim(), source: source.trim(), confirmedAt: new Date().toISOString() } }, actions: { ...caseData.actions, [recordId]: false } }, `Verified lot ${lot.trim()} for ${recordId}.`);
    setSelected(null); setToast('Evidence saved. Inventory and shipments are being checked again.');
  };
  const hold = id => {
    const value = !caseData.actions?.[id];
    update({ actions: { ...caseData.actions, [id]: value } }, `${value ? 'Recorded' : 'Removed'} operator hold confirmation for ${id}.`);
  };
  const sample = async () => {
    setLoading(true);
    try { const data = await api('demo'); setCase(sampleCase(data.case)); setSelected(null); setModal(null); navigate('overview'); setToast('A fresh synthetic recall drill is ready.'); } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  const newCase = () => {
    setCase({ id: `RR-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`, title: 'Untitled recall', organization: 'Your distribution workspace', mode: 'uploaded', provenance: { notice: 'empty', inventory: 'empty', shipments: 'empty' }, notice: { product: '', brand: '', sku: '', upc: '', lotCodes: [], reason: '', date: '', instructions: '', source: { name: 'Manual notice', text: '' }, confirmed: false }, records: [], shipments: [], resolutions: {}, actions: {}, activity: [event('Created a new recall workspace.')] });
    setModal(null); navigate('records');
  };
  const currentResult = results.find(r => r.id === selected);
  const currentRecord = caseData?.records.find(r => r.id === selected);
  const sampleMode = caseData && provenanceLabel(caseData) === 'Synthetic drill';
  const originLabel = caseData ? provenanceLabel(caseData) : 'Opening workspace';
  const checking = !!caseData && (!analysis && !error || analyzing);
  const determinationMessage = checking ? 'Checking source records' : 'Determinations unavailable';
  const ready = !!analysis && !analyzing && !error;

  return <div className="app-shell">
    <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
      <a href="#" className="brand" onClick={e => { e.preventDefault(); navigate('overview'); }}><span className="brand-mark"><PackageCheck size={24} strokeWidth={1.7} /></span>Recall<span>Ready</span></a>
      <div className="workspace-name"><span className="workspace-avatar">N</span><div><strong>{sampleMode ? 'Northline' : 'Your workspace'}</strong><span>Distribution workspace</span></div></div>
      <div className="nav-caption">Workspace</div>
      <nav aria-label="Main navigation">{pages.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}><Icon size={18} /><span>{label}</span>{id === 'evidence' && summary.reviewLots > 0 && <b>{summary.reviewLots}</b>}</button>)}</nav>
      <div className="sidebar-drill"><div className="mini-icon"><ShieldCheck size={21} /></div><strong>Practice the response.</strong><p>Trace a sample recall from notice to verified evidence.</p><button onClick={() => setModal('sample')}>Load sample drill <ArrowUpRight size={15} /></button></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setModal('settings')}><Settings2 size={17} /><span>AI connection</span><i className={health?.aiConfigured ? 'connection-dot connected' : 'connection-dot'} /></button><button className="nav-item" onClick={() => setModal('help')}><CircleHelp size={17} />How it works</button><div className="user"><span>OP</span><div><strong>Operator workspace</strong><small>Saved in this browser</small></div></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Toggle navigation" onClick={() => setNavOpen(!navOpen)}><ListFilter size={20} /></button><div className="breadcrumbs"><button type="button" className="workspace-link" onClick={() => navigate('overview')}>Workspace</button><ChevronRight size={14} /><strong>{pages.find(p => p.id === page)?.label}</strong></div><div className="top-actions"><span className={`mode-badge ${sampleMode ? '' : 'uploaded'}`}><span />{originLabel}</span><Button variant="secondary" onClick={() => setModal('new')}><Plus size={15} />New recall</Button></div></header>
      <main id="main-content">
        {restored.warning && <div role="status" className="warning-banner">{restored.warning}</div>}
        {error && <div role="alert" className="error-banner"><AlertTriangle size={19} /><div><strong>We couldn’t complete that check.</strong><p>{error}</p></div>{caseData && <button onClick={() => setRetry(value => value + 1)}>Retry check</button>}<button onClick={() => setModal('sample')}>Restore sample</button></div>}
        {!caseData ? <Empty icon={analyzing ? LoaderCircle : AlertTriangle} title={analyzing ? 'Opening your workspace' : 'Workspace unavailable'} action={!analyzing && <Button onClick={sample}>Try again</Button>}>Your recall records will appear here.</Empty> : <>
          {page === 'overview' && <>
            <div className="page-heading"><div><p className="heading-note">Your recall workspace</p><h1>Every lot accounted for.</h1><p>Trace the impact. Verify the evidence. Prepare your response.</p></div><Button variant="secondary" onClick={() => navigate('response')} disabled={!ready}><Download size={16} />Prepare response</Button></div>
            <section className="incident-hero"><div className="incident-copy"><div className="incident-meta"><span className="case-number">{caseData.id}</span><span className="small-dot" />{caseData.notice.date || 'Notice not yet added'}</div><h2>{caseData.title}</h2><p>{caseData.notice.brand || 'Add a recall notice to begin'}{caseData.notice.product && ` · ${caseData.notice.product}`}</p><div className="incident-reason"><AlertTriangle size={15} />{caseData.notice.reason || 'Define the product and affected lot codes in Source records.'}</div><button className="text-button" onClick={() => setModal('notice')}>View recall notice <ArrowUpRight size={15} /></button></div><CartonArt /></section>
            {!ready && <section className="panel"><Empty icon={checking ? LoaderCircle : AlertTriangle} title={determinationMessage}>{checking ? 'Totals and determinations will appear after the current check finishes.' : 'Restore the server connection or correct the source records to run the trace.'}</Empty></section>}
            {ready && <><section className="metrics" aria-label="Recall impact"><Metric label="Affected in warehouse" value={summary.warehouseQuantity} unit="cartons" icon={Boxes} detail={`${summary.affectedLots} affected records`} /><Metric label="Already shipped" value={summary.shippedQuantity} unit="cartons" icon={Truck} detail="Confirmed affected shipments" /><Metric label="Customers to contact" value={summary.affectedCustomers} icon={MapPin} detail="From shipment records" /><Metric label="Evidence gaps" value={summary.reviewLots} icon={ShieldCheck} detail={`${summary.unknownQuantity} warehouse cartons to verify`} amber={summary.reviewLots > 0} /></section>
            <div className="overview-grid"><section className="panel trace-panel"><div className="panel-heading"><div><h3>Follow the recall</h3><p>From the supplier notice to the last shipment.</p></div><span className="live-label"><span />{analyzing ? 'Checking records' : 'Current evidence'}</span></div><div className="trace-flow"><button className="trace-node" onClick={() => setModal('notice')}><span className="trace-icon"><FileText size={23} /></span><strong>Recall notice</strong><small>{caseData.notice.lotCodes.length} explicit lot codes</small></button><div className="connector"><span /><ArrowRight size={17} /></div><button className="trace-node" onClick={() => { setFilter('affected'); document.querySelector('#inventory-table')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><span className="trace-icon"><Package size={23} /></span><strong>{summary.affectedLots} affected records</strong><small>{summary.warehouseQuantity} cartons in warehouse</small></button><div className="connector"><span /><ArrowRight size={17} /></div><button className="trace-node" onClick={() => navigate('response')}><span className="trace-icon"><Truck size={23} /></span><strong>{summary.affectedCustomers} customers</strong><small>{summary.shippedQuantity} cartons dispatched</small></button></div><div className="trace-foot"><ShieldCheck size={15} />Every connection is backed by a source record.</div></section><section className={`gap-card ${summary.reviewLots === 0 ? 'resolved' : ''}`}><span className="gap-icon">{summary.reviewLots > 0 ? <Search size={24} /> : <CheckCheck size={25} />}</span><h3>{summary.reviewLots > 0 ? `${summary.reviewLots === 1 ? 'One gap' : `${summary.reviewLots} gaps`} to close.` : 'Evidence reconciled.'}</h3><p>{summary.reviewLots > 0 ? 'A record needs more evidence before it can be traced with confidence.' : 'No unresolved records in this case. Review the affected inventory and prepare your response.'}</p><Button variant={summary.reviewLots > 0 ? 'amber' : 'secondary'} onClick={() => navigate(summary.reviewLots > 0 ? 'evidence' : 'response')}>{summary.reviewLots > 0 ? 'Review missing evidence' : 'Review response'}<ArrowRight size={16} /></Button></section></div></>}
            <InventoryTable caseData={caseData} results={results} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onSelect={setSelected} analyzing={checking} unavailable={!ready && !checking} />
          </>}
          {page === 'records' && <RecordsPage caseData={caseData} update={update} health={health} setModal={setModal} notify={setToast} api={apiWithAccess} />}
          {page === 'evidence' && <><div className="page-heading"><div><p className="heading-note">Evidence review</p><h1>Make the missing connection.</h1><p>Resolve uncertain records with evidence from your receiving documents.</p></div><span className="count-pill">{ready ? `${summary.reviewLots} open ${summary.reviewLots === 1 ? 'record' : 'records'}` : determinationMessage}</span></div>{!ready ? <section className="panel"><Empty icon={checking ? LoaderCircle : AlertTriangle} title={determinationMessage}>Evidence determinations require a completed check of the current records.</Empty></section> : results.filter(r => r.status === 'review').length ? <div className="evidence-grid">{results.filter(r => r.status === 'review').map(result => { const record = caseData.records.find(r => r.id === result.id); if (!record) return null; return <article className="panel evidence-issue" key={result.id}><div className="issue-top"><Status status="review" /><span>{record.id}</span></div><h2>{record.product}</h2><p>{result.reason}</p><div className="issue-stats"><span><Boxes size={16} />{record.quantity} cartons in warehouse</span><span><Truck size={16} />{result.shipments.reduce((n, s) => n + s.quantity, 0)} cartons shipped</span></div><SourceCard source={record.source} /><Button onClick={() => setSelected(record.id)}>Review this record <ArrowRight size={16} /></Button></article>; })}</div> : <section className="panel"><Empty icon={ShieldCheck} title={caseData.records.length ? 'Every record has a determination' : 'No records to review'} action={<Button onClick={() => navigate(caseData.records.length ? 'response' : 'records')}>{caseData.records.length ? 'Prepare response' : 'Add source records'}<ArrowRight size={15} /></Button>}>{caseData.records.length ? 'Review the source evidence and record any inventory holds before exporting.' : 'Upload a recall notice and inventory to begin tracing.'}</Empty></section>}<section className="panel activity-panel"><div className="panel-heading"><h3>Verification history</h3><Activity size={18} /></div>{caseData.activity?.length ? <ol className="activity-list">{caseData.activity.slice().reverse().slice(0, 12).map(a => <li key={a.id}><span className="activity-dot" /><div>{a.text}<small>{new Date(a.at).toLocaleString()}</small></div></li>)}</ol> : <p className="muted pad">Verification actions will appear here as you review the evidence.</p>}</section></>}
          {page === 'response' && <ResponsePage caseData={caseData} analysis={analysis} ready={ready} checking={checking} reviewed={reviewed} setReviewed={setReviewed} hold={hold} setSelected={setSelected} navigate={navigate} notify={setToast} />}
          <footer className="page-footer"><span><ShieldCheck size={14} />{sampleMode ? 'Synthetic data. Practice actions only.' : `${originLabel}. Operator review required. Actions recorded locally.`}</span><span>RecallReady <span className="footer-version">Early build</span></span></footer>
        </>}
      </main>
    </div>
    {toast && <div className="toast" role="status"><CircleCheck size={18} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
    {currentRecord && currentResult && <EvidenceDialog key={currentRecord.id} record={currentRecord} result={currentResult} resolution={caseData.resolutions?.[currentRecord.id]} sampleMode={canUseSampleNote(caseData, currentRecord)} onClose={() => setSelected(null)} onResolve={resolve} />}
    {modal === 'notice' && caseData && <Modal title="Recall notice" subtitle="The scope used to check every inventory record." onClose={() => setModal(null)}><div className="modal-body"><div className="notice-summary"><strong>{caseData.notice.product || 'No product specified'}</strong><p>{caseData.notice.brand}</p><span className={`status ${caseData.notice.confirmed ? 'excluded' : 'review'}`}>{caseData.notice.confirmed ? 'Scope confirmed by operator' : 'Scope needs confirmation'}</span></div><dl className="detail-list"><dt>Product code</dt><dd>{caseData.notice.sku || 'Not provided'}</dd><dt>UPC</dt><dd>{caseData.notice.upc || 'Not provided'}</dd><dt>Affected lots</dt><dd>{caseData.notice.lotCodes.join(', ') || 'Not provided'}</dd><dt>Reason</dt><dd>{caseData.notice.reason || 'Not provided'}</dd></dl><SourceCard source={caseData.notice.source} /><Button variant="secondary" onClick={() => { setModal(null); navigate('records'); }}>Edit recall scope</Button></div></Modal>}
    {modal === 'settings' && <AiConnection health={health} unlocked={Boolean(accessCode)} onClose={() => setModal(null)} onUnlock={async code => { await api('access', {}, undefined, code); setAccessCode(code); }} onRefresh={async () => { try { setHealth(await api('health')); setToast('Connection settings refreshed.'); } catch(e) { setToast(e.message); } }} />}
    {modal === 'help' && <Modal title="From notice to response" subtitle="A focused workflow for a recall drill." onClose={() => setModal(null)}><div className="modal-body"><ol className="help-steps"><li><strong>Add the source records.</strong>Confirm the recall’s exact product identifiers and complete list of lot codes. Import warehouse inventory and linked shipments.</li><li><strong>Trace the impact.</strong>Records are marked affected, outside this recall, or needing verification. An unknown lot stays unresolved.</li><li><strong>Close evidence gaps.</strong>Check a receiving note and record the lot with its source. The system recalculates the affected shipments.</li><li><strong>Prepare the response.</strong>Record hold confirmations and export the evidence packet. Customer messages are drafts for operator review.</li></ol><p className="note">This build supports exact lot lists and quantities in cartons. Dates, geographic restrictions, ingredient transformations, and complex recall scopes need a fuller workflow before operational use.</p></div></Modal>}
    {(modal === 'sample' || modal === 'new') && <Modal title={modal === 'sample' ? 'Start a fresh sample drill?' : 'Start a new recall?'} subtitle="This replaces the case saved in this browser." onClose={() => setModal(null)}><div className="modal-body"><p>Export your response first if you want to keep a copy of this case. {modal === 'sample' ? 'All new sample records and verification steps are synthetic.' : 'You can enter a notice manually or extract one with Nemotron, then upload your inventory.'}</p><div className="form-actions"><Button variant="secondary" onClick={() => setModal(null)}>Keep current case</Button><Button busy={loading} onClick={modal === 'sample' ? sample : newCase}>{modal === 'sample' ? 'Load sample drill' : 'Create recall'}</Button></div></div></Modal>}
  </div>;
}

function Metric({ label, value, unit, icon: Icon, detail, amber }) {
  return <div className={`metric ${amber ? 'amber-metric' : ''}`}><div className="metric-label">{label}<Icon size={17} /></div><div className="metric-value">{value}<span>{unit}</span></div><p>{detail}</p></div>;
}

function InventoryTable({ caseData, results, query, setQuery, filter, setFilter, onSelect, analyzing, unavailable }) {
  const visible = results.filter(result => {
    const row = caseData.records.find(r => r.id === result.id);
    return row && (filter === 'all' || result.status === filter) && [row.id, row.product, row.lot, row.location, caseData.resolutions?.[row.id]?.lot].join(' ').toLowerCase().includes(query.toLowerCase());
  });
  return <section className="panel inventory-panel" id="inventory-table"><div className="panel-heading"><div><h3>Inventory trace <span className="small-count">{caseData.records.length}</span></h3><p>Review the source behind each determination.</p></div><label className="search-box"><Search size={16} /><input aria-label="Search inventory" placeholder="Find a product, lot, or location" value={query} onChange={e => setQuery(e.target.value)} /></label></div><div className="filter-tabs" aria-label="Filter inventory">{[['all','All records'],['affected','Affected'],['review','Needs verification'],['excluded','Outside this recall']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}{value === 'review' && results.some(r => r.status === value) && <span className="amber-dot" />}</button>)}{analyzing && <span className="checking"><LoaderCircle size={13} className="spin" />Checking</span>}</div><div className="table-scroll"><table><thead><tr><th>Product / record</th><th>Lot code</th><th>Location</th><th className="number-cell">Cartons</th><th>Determination</th><th><span className="sr-only">Review</span></th></tr></thead><tbody>{visible.map(result => { const row = caseData.records.find(r => r.id === result.id); if (!row) return null; const lot = caseData.resolutions?.[row.id]?.lot || row.lot; return <tr key={row.id} className={result.status === 'review' ? 'review-row' : ''}><td><button className="product-button" onClick={() => onSelect(row.id)}><span className={`product-icon ${result.status}`}><Package size={18} /></span><span><strong>{row.product}</strong><small>{row.id}</small></span></button></td><td>{lot ? <span className="lot-code">{lot}</span> : <span className="missing-value">Missing lot code</span>}</td><td className="location-cell">{row.location}</td><td className="number-cell">{row.quantity}</td><td><Status status={result.status} /></td><td><button className="icon-button" aria-label={`Review ${row.id}`} onClick={() => onSelect(row.id)}><ArrowUpRight size={17} /></button></td></tr>; })}</tbody></table></div>{!visible.length && <Empty title={analyzing ? 'Checking inventory' : unavailable ? 'Determinations unavailable' : caseData.records.length ? 'No matching records' : 'Your trace starts with source records'}>{analyzing ? 'Please wait for the current records to be checked.' : unavailable ? 'A completed analysis is required before displaying inventory decisions.' : caseData.records.length ? 'Try another search or status filter.' : 'Open Source records to upload inventory and a recall notice.'}</Empty>}<div className="table-footer"><span>{visible.length} of {caseData.records.length} records</span><span><ShieldCheck size={13} />Source-linked decisions</span></div></section>;
}

function EvidenceDialog({ record, result, resolution, sampleMode, onClose, onResolve }) {
  const [lot, setLot] = useState(resolution?.lot || record.lot || '');
  const [source, setSource] = useState(resolution?.source || '');
  const [confirmed, setConfirmed] = useState(false);
  return <Modal title={`Evidence for ${record.id}`} subtitle={`${record.product} · ${record.quantity} cartons in warehouse`} onClose={onClose} wide><div className="modal-body"><div className="determination"><Status status={result.status} /><p>{result.reason}</p></div><div className="evidence-dialog-grid"><section><h3>Supporting records</h3>{result.evidence.map((source, i) => <SourceCard key={i} source={source} />)}{result.shipments.length > 0 && <><h3>Linked shipments</h3>{result.shipments.map(s => <div className="shipment-mini" key={s.id}><Truck size={16} /><div><strong>{s.customer}</strong><small>{s.id}</small></div><b>{s.quantity} cartons</b></div>)}</>}</section><section className="verification-form"><span className="mini-icon"><ShieldCheck size={23} /></span><h3>Verify the lot code</h3><p>Read the original receiving record or package label. Record exactly what you checked.</p><form onSubmit={e => { e.preventDefault(); if (confirmed && lot.trim() && source.trim()) onResolve(record.id, lot, source); }}><label>Lot code<input required maxLength={100} value={lot} onChange={e => { setLot(e.target.value); setConfirmed(false); }} placeholder="e.g. CV-260801-02" /></label><label>Evidence source<textarea required maxLength={2000} value={source} onChange={e => { setSource(e.target.value); setConfirmed(false); }} placeholder="Document name, row or page, and the text you verified" rows={4} /></label>{sampleMode && record.id === 'INV-103' && <button type="button" className="sample-note" onClick={() => { setLot('CV-260801-02'); setSource('Synthetic receiving note RN-448: INV-103, Sesame Oat Bar 40 g, lot CV-260801-02. Checked by operator.'); setConfirmed(false); }}><FileText size={15} />Use sample receiving note<ArrowUpRight size={13} /></button>}<label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked this lot code against the cited source.</label><Button type="submit" disabled={!confirmed || !lot.trim() || !source.trim()}><Check size={16} />Save verification</Button></form><p className="fine-print">This updates the determination and linked shipments. Previous hold confirmation for this record will be cleared.</p></section></div></div></Modal>;
}

function RecordsPage({ caseData, update, health, setModal, notify, api }) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('recall-notice.txt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [candidateOrigin, setCandidateOrigin] = useState('uploaded');
  const [syntheticImport, setSyntheticImport] = useState(false);
  const [usage, setUsage] = useState(null);
  const [importData, setImportData] = useState(null);
  const inventoryInput = useRef(null), shipmentInput = useRef(null), noticeInput = useRef(null);
  const uploadNotice = async e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Choose a document smaller than 8 MB.');
      let content;
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const dataBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Could not read this file.')); reader.readAsDataURL(file); });
        content = (await api('document', { filename: file.name, dataBase64 })).text;
      } else content = await file.text();
      if (content.length > 100000) throw new Error('Keep document text under 100,000 characters.');
      setFilename(file.name); setText(content); notify('Document opened locally. Review it, then choose extraction or enter the scope manually.');
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  const extract = async () => {
    setBusy(true); setError(''); setUsage(null);
    try { const response = await api('extract', { filename, text }); setCandidateOrigin('uploaded'); setCandidate(response.notice); setUsage(response.usage); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  const importCsv = async (e, kind) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setError(''); setBusy(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a CSV smaller than 2 MB.');
      const response = await api('import', { kind, filename: file.name, text: await file.text() });
      if (kind === 'shipments') { const ids = new Set(caseData.records.map(r => r.id)); const missing = response.shipments.find(s => !ids.has(s.recordId)); if (missing) throw new Error(`Shipment ${missing.id} references ${missing.recordId}, which is not in inventory. Import matching inventory first.`); }
      setSyntheticImport(false); setImportData({ kind, filename: file.name, ...response });
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  const confirmImport = () => {
    const data = importData.kind === 'inventory' ? { records: importData.records, shipments: [], resolutions: {}, actions: {} } : { shipments: importData.shipments };
    const provenance = { [importData.kind]: syntheticImport ? 'sample' : 'uploaded', ...(importData.kind === 'inventory' ? { shipments: 'empty' } : {}) };
    update(withProvenance({ ...caseData, ...data }, provenance), `Imported ${importData.filename} as ${syntheticImport ? 'synthetic sample' : 'uploaded'} records.`); setImportData(null); notify('Records imported. The recall trace is being updated.');
  };
  return <><div className="page-heading"><div><p className="heading-note">Source records</p><h1>Start with the evidence.</h1><p>A recall notice, warehouse inventory, and the shipments that connect them.</p></div><Button variant="secondary" onClick={() => { setCandidateOrigin(provenanceOf(caseData).notice); setUsage(null); setCandidate({ ...caseData.notice }); }}><FileCheck2 size={16} />Edit recall scope</Button></div>{error && <div className="inline-error" role="alert"><AlertTriangle size={17} />{error}</div>}<section className="panel notice-upload"><div className="panel-heading"><div><h3>Recall notice</h3><p>Open a text-based PDF or paste the original notice.</p></div><span className="status excluded"><FileText size={13} />{caseData.notice.confirmed ? 'Scope confirmed' : 'Scope not confirmed'}</span></div><div className="notice-upload-body"><button className="drop-zone" onClick={() => noticeInput.current.click()} disabled={busy}><span><Upload size={25} /></span><strong>Choose a recall document</strong><p>Text-based PDF or TXT · up to 8 MB</p><span className="choose-label">Browse files</span></button><div className="notice-text"><label htmlFor="notice-text">Original notice text</label><textarea id="notice-text" rows={7} value={text} onChange={e => setText(e.target.value)} maxLength={100000} placeholder="Paste the manufacturer’s recall notice here. Nemotron will propose the product identifiers, lot codes, and cited evidence for your review." /><div className="notice-controls"><span>{filename}</span><Button busy={busy} onClick={extract} disabled={!text.trim() || !health?.aiConfigured}><Sparkles size={15} />Extract with Nemotron</Button></div><p className="fine-print">{!health?.aiConfigured ? 'Connect Nebius to enable extraction, or ' : 'You can also '}<button className="inline-link" onClick={() => { setCandidateOrigin('uploaded'); setCandidate(manualNotice(filename, text)); setUsage(null); }}>enter scope manually from this document</button>.</p></div></div></section><InvoiceIntake api={api} health={health} notify={notify} onImport={(records,synthetic) => update(withProvenance({ ...caseData, records, shipments: [], resolutions: {}, actions: {} }, { inventory: synthetic ? 'sample' : 'uploaded', shipments: 'empty' }), 'Operator verified inventory from a receiving document.')} /><div className="import-grid"><ImportCard title="Warehouse inventory" subtitle="One receipt or batch per row. Quantities are current warehouse cartons." count={caseData.records.length} countLabel="records" onClick={() => inventoryInput.current.click()} busy={busy} sample="inventory.csv" icon={Boxes} /><ImportCard title="Customer shipments" subtitle="Link each dispatched shipment to its inventory record ID." count={caseData.shipments.length} countLabel="shipments" onClick={() => shipmentInput.current.click()} busy={busy} sample="shipments.csv" icon={Truck} /></div><div className="record-guide"><FileCheck2 size={24} /><div><h3>Use the sample files as your template.</h3><p>Keep the column names intact. Product codes and lot numbers are text; quantities are whole cartons. Import inventory first, then its shipments.</p><a href="/samples/recall-notice.txt" download>Download sample recall notice <Download size={14} /></a></div></div><input hidden type="file" accept=".pdf,.txt,text/plain,application/pdf" ref={noticeInput} onChange={uploadNotice} /><input hidden type="file" accept=".csv,text/csv" ref={inventoryInput} onChange={e => importCsv(e,'inventory')} /><input hidden type="file" accept=".csv,text/csv" ref={shipmentInput} onChange={e => importCsv(e,'shipments')} />{candidate && <NoticeEditor notice={candidate} usage={usage} onClose={() => setCandidate(null)} onSave={notice => { update(withProvenance({ ...caseData, notice, title: notice.product, actions: {} }, { notice: candidateOrigin }), 'Operator reviewed and confirmed the recall scope.'); setCandidate(null); notify('Recall scope confirmed. All records are being checked again.'); }} />}{importData && <Modal title={`Import ${importData.kind}?`} subtitle={importData.filename} onClose={() => setImportData(null)}><div className="modal-body"><p><strong>{(importData.records || importData.shipments).length} rows</strong> passed format checks.</p><label className="checkbox-label"><input type="checkbox" checked={syntheticImport} onChange={e => setSyntheticImport(e.target.checked)} />These are synthetic sample records.</label><p>{importData.kind === 'inventory' ? 'This replaces the current inventory and clears linked shipments, verifications, and hold confirmations. Import the matching shipment file next.' : 'This replaces the current shipment list. All referenced inventory records were found.'}</p><div className="form-actions"><Button variant="secondary" onClick={() => setImportData(null)}>Cancel</Button><Button onClick={confirmImport}>Import records</Button></div></div></Modal>}</>;
}

function ImportCard({ title, subtitle, count, countLabel, onClick, busy, sample, icon: Icon }) {
  return <section className="panel import-card"><div className="import-card-top"><span className="mini-icon"><Icon size={25} /></span><span className="count-pill">{count} {countLabel}</span></div><h3>{title}</h3><p>{subtitle}</p><div className="import-card-actions"><Button variant="secondary" busy={busy} onClick={onClick}><Upload size={15} />Import CSV</Button><a href={`/samples/${sample}`} download>Sample CSV <Download size={14} /></a></div></section>;
}

function NoticeEditor({ notice, usage, onClose, onSave }) {
  const [draft, setDraft] = useState(notice);
  const [lots, setLots] = useState(notice.lotCodes.join(', '));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const field = key => ({ value: draft[key] || '', onChange: e => { setDraft({ ...draft, [key]: e.target.value }); setConfirmed(false); } });
  return <Modal title="Confirm the recall scope" subtitle="Check the proposed fields against the original notice before using them." onClose={onClose} wide><form className="modal-body" onSubmit={e => { e.preventDefault(); const lotCodes = [...new Set(lots.split(',').map(s => s.trim()).filter(Boolean))]; if (!lotCodes.length) return setError('Provide the complete explicit list of affected lot codes.'); if (!draft.sku.trim() && !draft.upc.trim() && !(draft.brand.trim() && draft.product.trim())) return setError('Provide a UPC, SKU, or both the exact brand and product name.'); if (confirmed) onSave({ ...draft, lotCodes, confirmed: true, scopeNote: '', source: { ...draft.source, text: draft.source.text || 'Scope manually entered and confirmed by operator.' } }); }}><div className="form-grid"><label>Product name<input required {...field('product')} /></label><label>Brand<input {...field('brand')} /></label><label>Product code / SKU<input {...field('sku')} /></label><label>UPC<input {...field('upc')} /></label><label>Notice date<input type="date" {...field('date')} /></label><label>Recall reason<input required {...field('reason')} /></label></div><label>Affected lot codes, separated by commas<textarea required rows={2} value={lots} onChange={e => { setLots(e.target.value); setConfirmed(false); }} placeholder="CV-260801-01, CV-260801-02, CV-260801-03" /></label><label>Supplier instructions<textarea rows={2} {...field('instructions')} /></label>{draft.scopeNote && <p className="warning-note"><AlertTriangle size={17} />{draft.scopeNote}</p>}<p className="fine-print">This build checks explicit lot lists. If the notice has additional date, geography, packaging, or other restrictions, resolve those before confirming the scope.</p><SourceCard source={draft.source} />{usage && <div className="usage-note"><Sparkles size={15} />{usage.model} · {(usage.latencyMs / 1000).toFixed(1)} s · {usage.promptTokens + usage.completionTokens} tokens</div>}<label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I verified the identifiers, complete lot list, and applicability of this recall against the source.</label>{error && <p className="inline-error" role="alert">{error}</p>}<div className="form-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!confirmed}><Check size={16} />Confirm scope</Button></div></form></Modal>;
}

function ResponsePage({ caseData, analysis, ready, checking, reviewed, setReviewed, hold, setSelected, navigate, notify }) {
  const summary = analysis?.summary || emptySummary;
  const affected = (analysis?.results || []).filter(r => r.status === 'affected');
  const customers = customerGroups(analysis?.results || []);
  const held = affected.filter(r => caseData.actions?.[r.id]).length;
  const save = format => {
    if (!ready) return;
    const slug = caseData.id.replace(/[^a-z0-9-]/gi, '-');
    if (format === 'html') download(`${slug}-response.html`, exportReport(caseData, analysis, reviewed), 'text/html;charset=utf-8');
    else download(`${slug}-manifest.csv`, exportManifest(caseData, analysis), 'text/csv;charset=utf-8');
    notify(`${format === 'html' ? 'Response packet' : 'Inventory manifest'} exported. Customer messages remain drafts.`);
  };
  return <><div className="page-heading"><div><p className="heading-note">Response packet</p><h1>Turn evidence into action.</h1><p>Review affected stock and customer drafts before exporting.</p></div><span className="draft-badge"><FileText size={14} />{reviewed ? 'Reviewed by operator' : 'Draft for review'}</span></div>{!ready && <section className="panel"><Empty icon={checking ? LoaderCircle : AlertTriangle} title={checking ? 'Checking source records' : 'Response unavailable'}>A completed check of the current case is required before reviewing or exporting the response.</Empty></section>}{ready && <>{summary.reviewLots > 0 && <div className="warning-banner"><AlertTriangle size={20} /><div><strong>{summary.reviewLots} unresolved {summary.reviewLots === 1 ? 'record remains' : 'records remain'}.</strong><p>The packet will include these records as needing verification. Their shipments are not included in confirmed affected totals.</p></div><Button variant="secondary" onClick={() => navigate('evidence')}>Review evidence</Button></div>}<div className="response-grid"><section className="panel"><div className="panel-heading"><div><h3>Warehouse hold checklist</h3><p>Record what an operator has actually confirmed.</p></div><span className="count-pill">{held} / {affected.length}</span></div><div className="hold-list">{affected.map(result => { const row = caseData.records.find(r => r.id === result.id); if (!row) return null; return <div className="hold-row" key={row.id}><input type="checkbox" aria-label={`Record hold for ${row.id}`} checked={!!caseData.actions?.[row.id]} onChange={() => hold(row.id)} disabled={!ready} /><div><button onClick={() => setSelected(row.id)}>{caseData.resolutions?.[row.id]?.lot || row.lot} <ArrowUpRight size={13} /></button><small>{row.id} · {row.location}</small></div><strong>{row.quantity} <small>cartons</small></strong></div>; })}{!affected.length && <Empty icon={Boxes} title="No confirmed affected records">Add and verify your source records to populate the response.</Empty>}</div><p className="fine-print panel-footnote">{provenanceLabel(caseData) === 'Synthetic drill' ? 'These are practice hold confirmations in a synthetic drill.' : `${provenanceLabel(caseData)}. Checks record operator confirmation only. They do not update warehouse systems.`}</p></section><aside className="panel export-card"><div className="export-icon"><FileCheck2 size={28} /></div><h3>Your evidence packet</h3><p>A portable report with the recall scope, traced records, source evidence, and customer drafts.</p><ul><li><Check size={15} />{summary.warehouseQuantity} affected warehouse cartons</li><li><Check size={15} />{summary.shippedQuantity} affected dispatched cartons</li><li><Check size={15} />{summary.affectedCustomers} customer drafts</li><li><Check size={15} />Unresolved records and verification history</li></ul><label className="checkbox-label"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} disabled={!ready} />I reviewed this packet and its unresolved records.</label><Button onClick={() => save('html')} disabled={!ready}><Download size={16} />Export {reviewed ? 'reviewed packet' : 'draft packet'}</Button><Button variant="secondary" onClick={() => save('csv')} disabled={!ready}>Download inventory CSV</Button><p className="fine-print">The HTML packet opens in any browser and can be printed to PDF.</p></aside></div><section className="panel customer-panel"><div className="panel-heading"><div><h3>Customer contact drafts</h3><p>Prepared from confirmed affected shipments. Nothing has been sent.</p></div><span className="small-count">{customers.length}</span></div>{customers.map(data => <article key={data.name} className="customer-draft"><span className="customer-avatar">{data.name.split(' ').slice(0,2).map(n => n[0]).join('')}</span><div><h4>{data.name}<span>{data.quantity} cartons</span></h4><p>Please review your receipt of {caseData.notice.product}. Our records link {data.quantity} cartons to the lots listed in the recall notice. Please follow the supplier’s instructions and confirm the quantities you can account for.</p><small>Linked records: {[...data.records].join(', ')} · Draft for operator review</small></div></article>)}{!customers.length && <p className="muted pad">Customer drafts appear when affected inventory has linked shipment records.</p>}</section></>}</>;
}
