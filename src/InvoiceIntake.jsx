import React, { useRef, useState } from 'react';
import { AlertTriangle, FileText, Plus, Sparkles, Trash2, Upload, Check } from 'lucide-react';
import { Button, Modal } from './components.jsx';

export default function InvoiceIntake({ api, health, onImport, notify }) {
  const input = useRef(null);
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('receiving-document.txt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState(null);
  const openFile = async e => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Choose a document smaller than 8 MB.');
      let content;
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const encoded = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Could not open this file.')); reader.readAsDataURL(file);
        });
        content = (await api('document', { filename: file.name, dataBase64: encoded })).text;
      } else content = await file.text();
      if (content.length > 100000) throw new Error('Keep the document under 100,000 characters.');
      setText(content); setFilename(file.name);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const extract = async () => {
    setBusy(true); setError('');
    try {
      const response = await api('extract', { kind: 'inventory', filename, text });
      setCandidate(response);
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  const blankRow = () => ({ id:'', product:'', brand:'', sku:'', upc:'', lot:'', quantity:null, unit:'cartons', location:'', source:{name:filename,text:text.slice(0,1000)} });
  return <section className="panel invoice-intake"><div className="panel-heading"><div><h3>Invoice or receiving document</h3><p>Turn document lines into inventory candidates, then confirm current stock.</p></div><FileText size={21} /></div><div className="invoice-body">{error && <div className="inline-error" role="alert"><AlertTriangle size={17} />{error}</div>}<div className="invoice-toolbar"><Button variant="secondary" busy={busy} onClick={() => input.current.click()}><Upload size={15} />Open PDF or text file</Button><span>{filename}</span></div><label htmlFor="invoice-text">Original invoice / receiving text</label><textarea id="invoice-text" rows={5} value={text} maxLength={100000} onChange={e => setText(e.target.value)} placeholder="Paste a receiving note or invoice. Product descriptions, codes, lot numbers, and source excerpts will be proposed for your review." /><div className="invoice-bottom"><p>Invoice quantities describe receipts. You must verify how many cartons remain in your warehouse.</p><Button variant="secondary" disabled={!text.trim() || busy} onClick={() => setCandidate({records:[blankRow()],usage:null})}><Plus size={15} />Enter rows manually</Button><Button disabled={!text.trim() || !health?.aiConfigured} busy={busy} onClick={extract}><Sparkles size={15} />Extract inventory</Button></div><input hidden ref={input} type="file" accept=".pdf,.txt,text/plain,application/pdf" onChange={openFile} /></div>{candidate && <InventoryEditor data={candidate} filename={filename} documentText={text} onClose={() => setCandidate(null)} onConfirm={(records,synthetic) => { onImport(records,synthetic); setCandidate(null); notify('Verified inventory imported. Upload its linked shipments next.'); }} />}</section>;
}

function InventoryEditor({ data, filename, documentText, onClose, onConfirm }) {
  const [rows,setRows] = useState(data.records.map(r => ({...r,receivedQuantity:r.quantity,quantity:''})));
  const [confirmed,setConfirmed] = useState(false);
  const [synthetic,setSynthetic] = useState(false);
  const [error,setError] = useState('');
  const change=(index,field,value)=>{setRows(current => current.map((r,i)=>i===index?{...r,[field]:value}:r));setConfirmed(false);};
  const submit=e=>{
    e.preventDefault(); setError('');
    if (!rows.length) return setError('Add at least one inventory row.');
    const ids=new Set(); const records=[];
    for (const [i,row] of rows.entries()) {
      const quantity=Number(row.quantity);
      if (!row.id.trim() || ids.has(row.id.trim())) return setError(`Row ${i+1}: provide a unique inventory record ID.`);
      if (String(row.quantity).trim()==='' || !Number.isSafeInteger(quantity) || quantity<0) return setError(`Row ${i+1}: enter current warehouse cartons as a whole number.`);
      if (!row.source.text.trim() || !documentText.includes(row.source.text)) return setError(`Row ${i+1}: the source excerpt must be copied exactly from the opened document.`);
      ids.add(row.id.trim());
      const {receivedQuantity,...record}=row;
      records.push({...record,id:row.id.trim(),quantity,unit:'cartons',source:{name:filename,text:row.source.text}});
    }
    if (confirmed) onConfirm(records,synthetic);
  };
  return <Modal title="Verify inventory from the document" subtitle="These rows replace existing inventory and clear its linked shipments and confirmations." onClose={onClose} wide><form className="modal-body" onSubmit={submit}><div className="warning-note"><AlertTriangle size={17} />Received quantities are shown only as reference. Enter the cartons currently on hand for each row. Missing lot codes remain unresolved.</div>{rows.map((row,index)=><fieldset className="inventory-candidate" key={index}><legend>Document row {index+1}</legend><div className="candidate-heading"><span>{row.receivedQuantity === null || row.receivedQuantity === undefined ? 'Received carton quantity not established' : `Proposed received quantity: ${row.receivedQuantity} cartons`}</span><button type="button" className="icon-button" aria-label={`Remove document row ${index+1}`} onClick={()=>{setRows(rows.filter((_,i)=>i!==index));setConfirmed(false);}}><Trash2 size={16}/></button></div><div className="form-grid">{[['id','Inventory record ID'],['product','Product name'],['brand','Brand'],['sku','Product code / SKU'],['upc','UPC'],['lot','Lot code (leave blank if unknown)'],['quantity','Current warehouse cartons'],['location','Warehouse / location']].map(([field,label])=><label key={field}>{label}<input required={['id','product','quantity','location'].includes(field)} type={field==='quantity'?'number':'text'} min={field==='quantity'?0:undefined} step={field==='quantity'?1:undefined} value={row[field]??''} onChange={e=>change(index,field,e.target.value)} /></label>)}</div><label>Exact source excerpt<textarea required rows={3} value={row.source.text} onChange={e=>change(index,'source',{name:filename,text:e.target.value})}/></label></fieldset>)}<Button type="button" variant="secondary" disabled={rows.length>=50} onClick={()=>{setRows([...rows,{id:'',product:'',brand:'',sku:'',upc:'',lot:'',quantity:'',unit:'cartons',location:'',source:{name:filename,text:''}}]);setConfirmed(false);}}><Plus size={15}/>Add row</Button>{data.usage && <p className="usage-note">{data.usage.model} · {(data.usage.latencyMs/1000).toFixed(1)} seconds · {data.usage.promptTokens+data.usage.completionTokens} tokens</p>}<label className="checkbox-label"><input type="checkbox" checked={synthetic} onChange={e=>setSynthetic(e.target.checked)}/>These are synthetic sample records.</label><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked every row, its source excerpt, and the current warehouse quantity. Replace inventory with these verified rows.</label>{error && <p className="inline-error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!confirmed||!rows.length}><Check size={16}/>Import verified inventory</Button></div></form></Modal>;
}
