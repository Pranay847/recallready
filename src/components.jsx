import React, { useEffect, useRef } from 'react';
import { Check, X, AlertCircle, CircleCheck, Minus, FileText, ArrowUpRight, LoaderCircle } from 'lucide-react';

export function Button({ children, variant = 'primary', className = '', busy, ...props }) {
  return <button className={`button ${variant} ${className}`} {...props} disabled={busy || props.disabled}>{busy && <LoaderCircle size={16} className="spin" />}{children}</button>;
}

export function Status({ status }) {
  const [label, Icon] = status === 'affected' ? ['Affected', AlertCircle] : status === 'review' ? ['Needs verification', AlertCircle] : ['Outside this recall', CircleCheck];
  return <span className={`status ${status}`}><Icon size={13} />{label}</span>;
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const focusable = () => [...node.querySelectorAll('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex="0"]')];
    focusable()[0]?.focus();
    const handler = e => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div><h2 id="dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}

export function SourceCard({ source, index }) {
  return <article className="source-card"><div className="source-title"><FileText size={16} /><strong>{source.name}</strong>{source.row && <span>Row {source.row}</span>}</div><pre>{source.text}</pre></article>;
}

export function Empty({ icon: Icon = FileText, title, children, action }) {
  return <div className="empty"><span><Icon size={30} strokeWidth={1.4} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function CartonArt() {
  return <svg className="carton-art" viewBox="0 0 360 220" role="img" aria-label="Three traceable product cartons, with one lot verified"><defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c8dbdb" /></pattern></defs><rect width="360" height="220" fill="url(#dots)"/><ellipse cx="190" cy="189" rx="119" ry="16" fill="#d4e6e4"/><path d="M55 116 110 90 169 119 114 146Z" fill="#d4bda0"/><path d="M55 116 114 146V197L55 166Z" fill="#b99168"/><path d="M114 146 169 119V169L114 197Z" fill="#cfab83"/><path d="m82 103 59 29v23l-20 10v-23l-59-30Z" fill="#e9dac8" opacity=".8"/><path d="M166 103 222 77 289 108 232 139Z" fill="#dbc8ac"/><path d="M166 103 232 139V191L166 158Z" fill="#b99a78"/><path d="M232 139 289 108V160L232 191Z" fill="#cfae87"/><path d="M112 47 176 17 243 49 179 83Z" fill="#e5d4ba"/><path d="M112 47 179 83V149L112 114Z" fill="#c2a07a"/><path d="M179 83 243 49V115L179 149Z" fill="#ddbc94"/><path d="m137 35 68 33v23l-21 11V79l-68-33Z" fill="#f3e6d4"/><path d="m126 78 33 17v31l-33-17Z" fill="#fffaf1"/><path d="m132 89 20 10m-20-3 15 8m-15-2 20 10" stroke="#637d7e" strokeWidth="2"/><path d="m193 110 32-17" stroke="#087e83" strokeWidth="4"/><rect x="223" y="43" width="109" height="39" rx="9" fill="white" stroke="#cde1df"/><circle cx="242" cy="62" r="10" fill="#e4f4ef"/><path d="m237 62 4 4 6-8" fill="none" stroke="#087e83" strokeWidth="2"/><text x="260" y="67" fontSize="12" fontFamily="Segoe UI, sans-serif" fill="#20515a">Lot verified</text><path d="M212 157h41q20 0 20-22v-8" stroke="#087e83" fill="none" strokeWidth="1.5" strokeDasharray="4 4"/><circle cx="212" cy="157" r="4" fill="#087e83"/></svg>;
}
