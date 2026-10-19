import { useState } from 'react';
import { Users, LayoutGrid, UserSquare, Smile, MessageCircle, Captions, Sparkles, Columns, Shield, X, Pin, PinOff, Star, MicOff, UserMinus, Ban, Droplet, Plus } from './icons';

export default function MeetingTools({ features: f, isAdmin, myId, layout, setLayout, pinned, setPinned,
  background, changeBackground, unread, openChat }) {
  const [panel, setPanel] = useState(null);
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);
  const own = f.state.participants.find(p => p.socketId === myId);
  // Show host toggles immediately; the server's meeting-state confirms (or reverts) them.
  const [optimistic, setOptimistic] = useState({});
  const settings = { ...f.state, ...optimistic };
  async function changeSetting(key, value) {
    setOptimistic(o => ({ ...o, [key]: value }));
    await f.act('meeting-settings', { [key]: value });
    setOptimistic(o => { const next = { ...o }; delete next[key]; return next; });
  }
  async function effect(mode, file) {
    setBusy(true);
    try { await changeBackground(mode, file); f.setNotice(''); }
    catch (error) { f.setNotice(error.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="meeting-tools" aria-label="Meeting tools">
      <button className="icon-btn" onClick={() => setPanel('people')}><Users size={16} /> Participants ({f.state.participants.length})</button>
      <button className="icon-btn" onClick={() => setLayout(layout === 'gallery' ? 'speaker' : 'gallery')}>{layout === 'gallery' ? <><UserSquare size={16} /> Speaker view</> : <><LayoutGrid size={16} /> Gallery view</>}</button>
      <button aria-pressed={!!own?.handRaised} onClick={() => f.act('raise-hand', { raised: !own?.handRaised })}>{own?.handRaised ? 'Lower hand' : '✋ Raise hand'}</button>
      <button className="icon-btn" onClick={() => setPanel('reactions')}><Smile size={16} /> Reactions</button>
      <button className="icon-btn" onClick={openChat}><MessageCircle size={16} /> Chat{unread > 0 ? ` (${unread})` : ''}</button>
      <button className="icon-btn" onClick={() => setPanel('captions')} aria-pressed={f.captionsEnabled}><Captions size={16} /> Captions</button>
      <button className="icon-btn" onClick={() => setPanel('background')}><Sparkles size={16} /> Background</button>
      {(isAdmin || f.state.breakouts.length > 0 || f.state.parentRoomId) && <button className="icon-btn" onClick={() => setPanel('breakouts')}><Columns size={16} /> Breakout rooms</button>}
      {isAdmin && <button className="icon-btn" onClick={() => setPanel('host')}><Shield size={16} /> Host controls</button>}
    </div>
    {f.notice && <div className="meeting-notice" role="alert">{f.notice}<button className="icon-btn" onClick={() => f.setNotice('')}><X size={14} /> Dismiss</button></div>}
    {panel && <aside className="meeting-panel" aria-label="Meeting options"><header><h2>{{people:'Participants',reactions:'Reactions',captions:'Live captions',background:'Background effects',breakouts:'Breakout rooms',host:'Host controls'}[panel]}</h2><button aria-label="Close panel" onClick={() => setPanel(null)}>✕</button></header>
      {panel === 'people' && <><label>Search participants<input value={search} onChange={e => setSearch(e.target.value)} /></label>
        {f.state.participants.filter(p => String(p.userName).toLowerCase().includes(search.toLowerCase())).map(p => <div key={p.socketId} className="participant-row">
          <strong>{p.handRaised ? '✋ ' : ''}{p.userName}{p.socketId === myId ? ' (You)' : ''}</strong><br /><small>{p.isMuted ? 'Muted' : 'Microphone on'} · {p.role}</small>
          <div className="meeting-actions"><button className="icon-btn" onClick={() => setPinned(pinned === p.socketId ? null : p.socketId)}>{pinned === p.socketId ? <><PinOff size={14} /> Unpin</> : <><Pin size={14} /> Pin</>}</button>
            {isAdmin && <button className="icon-btn" onClick={() => f.act('meeting-settings', { spotlightId: f.state.spotlightId === p.socketId ? null : p.socketId })}><Star size={14} /> {f.state.spotlightId === p.socketId ? 'Remove spotlight' : 'Spotlight'}</button>}
            {isAdmin && p.socketId !== myId && <><button className="icon-btn" onClick={() => f.act('host-mute', { socketId: p.socketId })}><MicOff size={14} /> Mute</button><button className="icon-btn" onClick={() => window.confirm(`Remove ${p.userName} from this meeting?`) && f.act('host-remove', { socketId: p.socketId })}><UserMinus size={14} /> Remove</button></>}
          </div></div>)}</>}
      {panel === 'reactions' && <div className="meeting-actions">{['👍','👏','❤️','😂','🎉'].map(emoji => <button key={emoji} style={{fontSize:32}} onClick={() => { f.act('reaction', { emoji }); setPanel(null); }}>{emoji}</button>)}</div>}
      {panel === 'host' && <><label><span><input type="checkbox" checked={settings.locked} onChange={e => changeSetting('locked', e.target.checked)} /> Lock meeting</span></label><p>Prevents new participants joining. Existing attendees can reconnect.</p>
        <label><span><input type="checkbox" checked={settings.allowScreenShare} onChange={e => changeSetting('allowScreenShare', e.target.checked)} /> Allow participants to share screens</span></label>
        <button className="icon-btn" onClick={() => f.act('host-mute', {})}><MicOff size={16} /> Mute everyone else</button><p>Participants can choose to unmute themselves.</p>
        {f.state.spotlightId && <button className="icon-btn" onClick={() => f.act('meeting-settings', { spotlightId: null })}><Star size={16} /> Clear spotlight</button>}</>}
      {panel === 'captions' && <><label><span><input type="checkbox" checked={f.captionsEnabled} onChange={e => f.setCaptionsEnabled(e.target.checked)} /> Show shared captions</span></label>
        <p>Each speaker can enable transcription of their own microphone. Your browser may send speech to its recognition service.</p>
        <label>Spoken language<select value={f.language} onChange={e => f.setLanguage(e.target.value)}>{[['en-US','English'],['es-ES','Spanish'],['fr-FR','French'],['de-DE','German'],['ru-RU','Russian'],['tr-TR','Turkish'],['ar-SA','Arabic'],['zh-CN','Chinese']].map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {f.speechSupported ? <label><span><input type="checkbox" checked={f.transcribe} onChange={e => { f.setTranscribe(e.target.checked); f.setCaptionsEnabled(true); }} /> Transcribe and share my speech</span></label> : <p role="status">This browser does not support speech recognition. Captions from other participants are still available.</p>}
        <p>Transcription pauses when your microphone is muted. Accuracy and language support depend on your browser.</p></>}
      {panel === 'background' && <><p>Effects run on this device. The first use downloads the segmentation model; an internet connection is required for setup.</p>
        <div className="meeting-actions">{[['none','None',<Ban size={16} />],['blur','Blur',<Droplet size={16} />],['studio','Studio',<Sparkles size={16} />]].map(([mode,label,icon]) => <button className="icon-btn" disabled={busy} aria-pressed={background === mode} key={mode} onClick={() => effect(mode)}>{icon} {label}</button>)}</div>
        <label>Custom background image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files[0]; if (file) effect('image', file); e.target.value = ''; }} /></label>{busy && <p role="status">Preparing background…</p>}</>}
      {panel === 'breakouts' && <>
        {f.state.parentRoomId && <a href={`/room/${f.state.parentRoomId}`}>Return to main meeting</a>}
        {isAdmin && !f.state.parentRoomId && <>{!f.state.breakouts.length ? <><label>Number of rooms<input type="number" min="1" max="8" value={count} onChange={e => setCount(Number(e.target.value))} /></label><button className="icon-btn" onClick={() => f.act('breakouts-create', { count })}><Plus size={16} /> Create breakout rooms</button></> : <button className="icon-btn" onClick={() => f.act('breakouts-close', {})}><X size={16} /> Close rooms and bring everyone back</button>}</>}
        {f.state.breakouts.map(room => <section key={room.id} className="participant-row"><strong>{room.name}</strong>{isAdmin && <label>Move participant<select value="" onChange={e => f.act('breakout-assign', { roomId: room.id, socketId: e.target.value })}><option value="">Choose participant</option>{f.state.participants.filter(p => p.role !== 'interpreter' && p.socketId !== myId).map(p => <option key={p.socketId} value={p.socketId}>{p.userName}</option>)}</select></label>}</section>)}
        {!isAdmin && !f.state.parentRoomId && <p>The host assigns participants to breakout rooms.</p>}
      </>}
    </aside>}
    {!!f.reactions.length && <div className="reaction-pop" aria-live="polite">{f.reactions.map(r => <div key={r.id}>{r.emoji} {r.userName}</div>)}</div>}
    {f.captionsEnabled && !!f.captions.length && <div className="caption-strip" aria-live="polite">{f.captions.map(c => <div key={c.id}><strong>{c.userName}: </strong>{c.text}</div>)}</div>}
  </>;
}
