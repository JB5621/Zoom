import { useEffect, useRef, useState } from 'react';
import { Download, Send, X } from './icons';

function downloadFile(file) {
  const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function MeetingChat({ messages, onSend, myId, participants, onClose }) {
  const [text, setText] = useState('');
  const [to, setTo] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { const close = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  async function send(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      if (to && !participants.some(p => p.socketId === to)) throw Error('Recipient left. Choose another recipient.');
      let attachment = null;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
        attachment = { name: file.name, base64: btoa(binary) };
      }
      await onSend({ message: text, to: to || null, file: attachment }); setText(''); setFile(null);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function exportChat() {
    const body = messages.map(m => `${new Date(m.timestamp).toLocaleString()} | ${m.userName}${m.to ? ` → ${m.toName} (private)` : ''}: ${m.message}${m.file ? ` [File: ${m.file.name}]` : ''}`).join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = 'meeting-chat.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return <aside className="meeting-chat"><header><h2>Meeting chat</h2><button aria-label="Close chat" onClick={onClose}>✕</button></header>
    <button className="icon-btn" onClick={exportChat}><Download size={16} /> Download chat</button>
    <div className="chat-log" aria-live="polite">{messages.map(m => <article key={m.id} className={`chat-entry ${m.to ? 'private' : ''}`}><strong>{m.from === myId ? 'You' : m.userName}</strong>
      <small>{m.to ? `Private · to ${m.toName}` : 'Everyone'} · {new Date(m.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</small>
      <p>{m.message}</p>{m.file && <button onClick={() => downloadFile(m.file)}>↓ {m.file.name} ({Math.ceil(m.file.size / 1024)} KB)</button>}</article>)}<div ref={bottom} /></div>
    <form onSubmit={send}><label>Send to <select value={to} onChange={e => setTo(e.target.value)}><option value="">Everyone</option>{participants.filter(p => p.socketId !== myId).map(p => <option key={p.socketId} value={p.socketId}>{p.userName}</option>)}</select></label>
      <div className="meeting-actions"><input aria-label="Message" placeholder="Write a message…" maxLength={4000} value={text} onChange={e => setText(e.target.value)} style={{flex:1}} /><button className="icon-btn" disabled={busy || !text.trim() && !file}><Send size={16} /> Send</button></div>
      <label>Attach file (up to 512 KB)<input type="file" onChange={e => { const selected = e.target.files[0]; if (selected?.size > 512 * 1024) setError('Choose a file of 512 KB or smaller.'); else { setFile(selected || null); setError(''); } e.target.value = ''; }} /></label>
      {file && <div>{file.name} <button className="icon-btn" type="button" onClick={() => setFile(null)}><X size={14} /> Remove</button></div>}
      {error && <p role="alert">{error}</p>}
      <small>Recent public text is shared with new arrivals. Files and private messages are delivered live. This tab keeps the latest 200 messages.</small>
    </form></aside>;
}
