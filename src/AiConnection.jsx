import React, { useState } from 'react';
import { Sparkles, RotateCcw, ExternalLink } from 'lucide-react';
import { Modal, Button } from './components.jsx';

export default function AiConnection({ health, unlocked, onUnlock, onClose, onRefresh }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(unlocked);
  return <Modal title="AI connection" subtitle="NVIDIA Nemotron on Nebius Token Factory" onClose={onClose}>
    <div className="modal-body">
      <div className={`connection-state ${health?.aiConfigured ? 'on' : ''}`}><Sparkles size={24} /><div>
        <strong>{health?.aiConfigured ? (health.hosted ? 'Live AI available' : 'API key configured') : 'Live AI is not connected'}</strong>
        <p>{health?.aiConfigured ? 'A live extraction will verify model access.' : 'The sample drill uses prepared records and deterministic checks.'}</p>
      </div></div>
      {health?.hosted ? <>
        <p>The sample drill is open to everyone. For live document extraction, use the judge access code supplied with the demo instructions.</p>
        {health.aiConfigured && <form onSubmit={async e => {
          e.preventDefault(); setBusy(true); setError('');
          try { await onUnlock(code.trim()); setVerified(true); setCode(''); }
          catch (error) { setError(error.message); }
          finally { setBusy(false); }
        }}>
          <label>Judge access code<input type="password" autoComplete="off" maxLength={512} value={code} onChange={e => setCode(e.target.value)} /></label>
          {error && <p role="alert" className="inline-error">{error}</p>}
          {verified && <p role="status" className="note">Live extraction is unlocked for this tab until you refresh or close it.</p>}
          <div className="form-actions"><Button busy={busy} disabled={!code.trim()} type="submit">Unlock live extraction</Button></div>
        </form>}
        <p className="fine-print">Use fictional records for this public demo. Live extraction sends document text to Nebius and has shared usage limits.</p>
      </> : <>
        <p>To interpret a new recall document with Nemotron, add your key to the local <code>.env</code> file, then restart the server.</p>
        <pre className="config-example">NEBIUS_API_KEY=your-key-here</pre>
        <p className="muted">Your key stays on the server. Document text is sent to Nebius only when you choose extraction.</p>
      </>}
      <dl className="detail-list"><dt>Model</dt><dd>{health?.model || 'nvidia/nemotron-3-super-120b-a12b'}</dd><dt>Matching</dt><dd>Deterministic product and lot checks</dd></dl>
      <Button variant="secondary" onClick={onRefresh}><RotateCcw size={15} />Refresh connection</Button>
      {!health?.hosted && <a className="external-link" href="https://docs.tokenfactory.nebius.com/quickstart" target="_blank" rel="noreferrer">Get a Nebius API key <ExternalLink size={14} /></a>}
    </div>
  </Modal>;
}
