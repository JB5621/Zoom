// ============================================================
// InterpretationPanel.jsx — fixed, all imports at top
// ============================================================
import React, { useState, useEffect } from "react";
import { Globe, Volume2, Trash2, Copy, Check } from "./icons";

const LANGUAGES = [
  "English","Spanish","French","German","Portuguese","Italian",
  "Dutch","Russian","Turkmen","Japanese","Korean","Mandarin Chinese","Cantonese",
  "Arabic","Hindi","Turkish","Polish","Swedish","Norwegian","Danish",
  "Finnish","Ukrainian","Romanian","Czech","Hungarian","Greek",
  "Hebrew","Thai","Vietnamese","Indonesian","Malay","Tagalog","Bengali","Swahili",
];

function Modal({ children, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position:"fixed",inset:0,background:"rgba(12,74,110,0.4)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,
      padding:"clamp(12px, 3vw, 16px)",
    }}>
      <div style={{
        background:"#FFFFFF",border:"1px solid #BAE6FD",
        borderRadius:"14px",
        width:"100%",maxWidth:"clamp(280px, 90vw, 520px)",maxHeight:"88vh",overflowY:"auto",
        boxShadow:"0 20px 50px rgba(0,0,0,0.15)",
      }}>
        {children}
      </div>
    </div>
  );
}

function Header({ title, sub, onClose }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"clamp(14px, 3vw, 22px) clamp(16px, 3vw, 24px) clamp(10px, 3vw, 16px)",
      borderBottom:"1px solid #BAE6FD",
      position:"sticky",top:0,background:"#FFFFFF",zIndex:1,gap:"clamp(8px, 2vw, 12px)",
    }}>
      <div>
        <div style={{ fontWeight:700,
          fontSize:"clamp(0.9rem, 3vw, 1.05rem)",color:"#0C4A6E" }}>
          {title}
        </div>
        {sub && <div style={{ color:"#0369A1",fontSize:"clamp(0.7rem, 1.5vw, 0.78rem)",
          marginTop:"clamp(1px, 0.5vw, 3px)" }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{
        background:"#E0F2FE",border:"1px solid #BAE6FD",
        borderRadius:"8px",color:"#0369A1",
        width:"clamp(32px, 8vw, 40px)",height:"clamp(32px, 8vw, 40px)",
        cursor:"pointer",fontSize:"clamp(0.8rem, 2vw, 1rem)",
        display:"flex",alignItems:"center",justifyContent:"center",
        fontFamily:"inherit",minWidth:"44px",minHeight:"44px",
      }}>✕</button>
    </div>
  );
}

function LangSelect({ value, onChange, exclude, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      flex:1,background:"#FFFFFF",border:"1px solid #7DD3FC",
      borderRadius:"8px",padding:"clamp(8px, 1.5vw, 10px) clamp(8px, 2vw, 12px)",
      color:value?"#0C4A6E":"#38BDF8",fontSize:"clamp(0.8rem, 2vw, 0.88rem)",
      outline:"none",cursor:"pointer",fontFamily:"inherit",minHeight:"44px",
    }}>
      <option value="" disabled>{placeholder}</option>
      {LANGUAGES.filter(l => l !== exclude).map(l =>
        <option key={l} value={l}>{l}</option>
      )}
    </select>
  );
}

function CreateChannelForm({ onCreate }) {
  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");

  function handle() {
    if (!src || !tgt || src === tgt) return;
    onCreate(src, tgt);
    setSrc(""); setTgt("");
  }

  return (
    <div style={{
      background:"#F0F9FF",border:"1px solid #BAE6FD",
      borderRadius:"10px",padding:"clamp(12px, 3vw, 16px)",
      marginBottom:"clamp(12px, 3vw, 20px)",
    }}>
      <div style={{ color:"#0284C7",fontSize:"clamp(0.65rem, 1.5vw, 0.75rem)",
        fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",
        marginBottom:"clamp(8px, 2vw, 12px)" }}>
        New Language Channel
      </div>
      <div style={{ display:"flex",gap:"clamp(6px, 2vw, 8px)",flexWrap:"wrap",alignItems:"center" }}>
        <LangSelect value={src} onChange={setSrc} exclude={tgt} placeholder="Source language" />
        <span style={{ color:"#38BDF8",fontSize:"clamp(0.9rem, 2vw, 1.1rem)" }}>→</span>
        <LangSelect value={tgt} onChange={setTgt} exclude={src} placeholder="Target language" />
        <button onClick={handle} disabled={!src||!tgt||src===tgt} style={{
          padding:"clamp(8px, 2vw, 10px) clamp(10px, 2vw, 16px)",
          background:"#0EA5E9",
          border:"none",borderRadius:"8px",color:"#fff",
          fontWeight:600,fontSize:"clamp(0.75rem, 2vw, 0.85rem)",
          whiteSpace:"nowrap",cursor:(!src||!tgt||src===tgt)?"not-allowed":"pointer",
          opacity:(!src||!tgt||src===tgt)?0.5:1,minHeight:"44px",minWidth:"44px",
        }}>Create</button>
      </div>
    </div>
  );
}

function ChannelCard({ channel, token, onDelete }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = token ? `${window.location.origin}/interpreter?token=${token}` : null;

  function copy() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background:"#FFFFFF",border:"1px solid #BAE6FD",
      borderRadius:"10px",padding:"clamp(12px, 3vw, 16px)",
      marginBottom:"clamp(8px, 2vw, 12px)",
    }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:"clamp(8px, 2vw, 12px)",gap:"clamp(6px, 2vw, 10px)",flexWrap:"wrap" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"clamp(6px, 2vw, 10px)",flexWrap:"wrap" }}>
          <span style={{ fontWeight:700,
            color:"#0C4A6E",fontSize:"clamp(0.85rem, 2vw, 1rem)" }}>
            {channel.name}
          </span>
          {channel.active
            ? <span style={{ fontSize:"clamp(0.6rem, 1.5vw, 0.7rem)",
              background:"#F0FDF4",color:"#15803D",borderRadius:"6px",
              border:"1px solid #BBF7D0",
              padding:"clamp(1px, 0.5vw, 2px) clamp(4px, 1vw, 8px)",fontWeight:600,whiteSpace:"nowrap" }}>
                LIVE — {channel.interpreterName}
              </span>
            : <span style={{ fontSize:"clamp(0.6rem, 1.5vw, 0.7rem)",
              background:"#FFFBEB",color:"#B45309",
              border:"1px solid #FDE68A",
              borderRadius:"6px",padding:"clamp(1px, 0.5vw, 2px) clamp(4px, 1vw, 8px)",
              fontWeight:600,whiteSpace:"nowrap" }}>
                Awaiting interpreter
              </span>
          }
        </div>
        <button onClick={() => onDelete(channel.id)} style={{
          background:"none",border:"none",color:"#38BDF8",cursor:"pointer",
          fontSize:"clamp(0.85rem, 2vw, 1rem)",padding:"clamp(2px, 0.5vw, 6px)",
          minWidth:"44px",minHeight:"44px",display:"flex",alignItems:"center",justifyContent:"center",
        }}><Trash2 size={16} /></button>
      </div>

      {inviteUrl && (
        <>
          <div style={{ color:"#0369A1",fontSize:"clamp(0.65rem, 1.5vw, 0.75rem)",marginBottom:"clamp(4px, 1vw, 6px)" }}>
            Interpreter invite link:
          </div>
          <div style={{ display:"flex",gap:"clamp(6px, 1.5vw, 8px)",flexWrap:"wrap" }}>
            <div style={{
              flex:1,minWidth:"150px",background:"#E0F2FE",border:"1px solid #BAE6FD",
              borderRadius:"8px",padding:"clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)",
              fontSize:"clamp(0.7rem, 1.5vw, 0.78rem)",color:"#0369A1",
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
            }}>{inviteUrl}</div>
            <button onClick={copy} style={{
              padding:"clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 14px)",
              background:copied?"#F0FDF4":"#FFFFFF",
              border:`1px solid ${copied?"#BBF7D0":"#7DD3FC"}`,
              borderRadius:"8px",color:copied?"#15803D":"#0C4A6E",
              cursor:"pointer",fontSize:"clamp(0.7rem, 1.5vw, 0.8rem)",fontWeight:600,
              fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"6px",
              minHeight:"44px",
            }}>{copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}</button>
          </div>
          <p style={{ color:"#38BDF8",fontSize:"clamp(0.65rem, 1.5vw, 0.72rem)",
            marginTop:"clamp(4px, 1vw, 6px)" }}>
            Send this to your interpreter. They will join invisibly and speak in {channel.targetLang}.
          </p>
        </>
      )}
    </div>
  );
}

function LanguagePicker({ channels, selectedChannelId, onSelect }) {
  return (
    <div style={{ padding:"0 clamp(16px, 3vw, 24px) clamp(16px, 3vw, 24px)" }}>
      <div style={{ color:"#0369A1",fontSize:"clamp(0.65rem, 1.5vw, 0.75rem)",
        fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",
        marginBottom:"clamp(10px, 2vw, 14px)" }}>
        Audio Source — Click to toggle
      </div>

      <button onClick={() => onSelect(null)} style={{
        display:"flex",alignItems:"center",gap:"clamp(10px, 2vw, 14px)",width:"100%",
        padding:"clamp(10px, 2vw, 14px) clamp(12px, 2vw, 16px)",
        marginBottom:"clamp(6px, 1.5vw, 10px)",
        background:!selectedChannelId?"#F0F9FF":"#FFFFFF",
        border:`1px solid ${!selectedChannelId?"#BAE6FD":"#BAE6FD"}`,
        borderRadius:"10px",cursor:"pointer",textAlign:"left",fontFamily:"inherit",
        minHeight:"44px",fontSize:"clamp(0.85rem, 2vw, 0.92rem)",
      }}>
        <span style={{ display:"flex",color:!selectedChannelId?"#0EA5E9":"#0369A1" }}><Volume2 size={22} /></span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600,
            color:!selectedChannelId?"#0EA5E9":"#0C4A6E",fontSize:"clamp(0.85rem, 2vw, 0.92rem)" }}>
            Original Audio
          </div>
          <div style={{ color:"#0369A1",fontSize:"clamp(0.7rem, 1.5vw, 0.78rem)" }}>
            Hear all participants — interpreters muted
          </div>
        </div>
        {!selectedChannelId && <span style={{ fontSize:"clamp(0.6rem, 1.5vw, 0.7rem)",
          color:"#0EA5E9",fontWeight:700,whiteSpace:"nowrap",padding:"4px 8px",
          background:"#E0F2FE",borderRadius:"6px" }}>ACTIVE</span>}
      </button>

      {channels.length === 0 && (
        <p style={{ color:"#38BDF8",textAlign:"center",fontSize:"clamp(0.8rem, 2vw, 0.85rem)",
          padding:"clamp(16px, 4vw, 24px) 0" }}>
          No interpretation channels available yet.
        </p>
      )}

      {channels.map(ch => {
        const active = selectedChannelId === ch.id;
        return (
          <button key={ch.id} onClick={() => ch.active && onSelect(active ? null : ch.id)}
            disabled={!ch.active} style={{
            display:"flex",alignItems:"center",gap:"14px",width:"100%",
            padding:"14px 16px",marginBottom:"10px",
            background:active?"#F0FDF4":"#FFFFFF",
            border:`1px solid ${active?"#BBF7D0":"#BAE6FD"}`,
            borderRadius:"10px",cursor:ch.active?"pointer":"not-allowed",
            textAlign:"left",fontFamily:"inherit",opacity:ch.active?1:0.5,
            minHeight:"44px",
          }}>
            <span style={{ display:"flex",color:active?"#15803D":"#0EA5E9" }}><Globe size={22} /></span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600,
                color:active?"#15803D":"#0C4A6E",fontSize:"0.92rem" }}>{ch.name}</div>
              <div style={{ fontSize:"0.78rem",color:ch.active?"#0369A1":"#38BDF8" }}>
                {ch.active ? `${ch.interpreterName} is live` : "Waiting for interpreter…"}
              </div>
            </div>
            {active && <span style={{ fontSize:"0.7rem",color:"#15803D",fontWeight:700,
              padding:"4px 8px",background:"#DCFCE7",borderRadius:"6px" }}>ACTIVE</span>}
            {ch.active && !active && <span style={{ fontSize:"0.65rem",color:"#0369A1",fontWeight:600,
              padding:"4px 8px",background:"#E0F2FE",borderRadius:"6px" }}>Click to switch</span>}
          </button>
        );
      })}

      {selectedChannelId && (
        <div style={{ marginTop:"16px",padding:"12px 16px",
          background:"#FFFBEB",border:"1px solid #FDE68A",
          borderRadius:"10px",display:"flex",alignItems:"center",gap:"10px" }}>
          <span style={{ display:"flex",color:"#D97706" }}><Volume2 size={18} /></span>
          <div style={{ flex:1 }}>
            <div style={{ color:"#B45309",fontSize:"0.82rem",fontWeight:600 }}>
              Interpreter mode active
            </div>
            <div style={{ color:"#92400E",fontSize:"0.7rem",marginTop:"2px" }}>
              Only hearing interpreter — original speakers muted. Click "Original Audio" to switch back.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterpretationPanel({
  isAdmin, channels, adminTokens, selectedChannelId,
  onSelectChannel, onCreateChannel, onDeleteChannel, onClose,
}) {
  const [tab, setTab] = useState(isAdmin ? "manage" : "listen");

  return (
    <Modal onClose={onClose}>
      <Header
        title="Language Interpretation"
        sub={isAdmin
          ? "Create channels and share invite links with interpreters"
          : "Select a language channel to listen to"}
        onClose={onClose}
      />

      {isAdmin && (
        <div style={{ display:"flex",gap:"4px",padding:"12px 24px 0",
          borderBottom:"1px solid #BAE6FD" }}>
          {[{id:"listen",label:"Listen"},{id:"manage",label:"Manage"}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"8px 18px",
              background:tab===t.id?"#F0F9FF":"transparent",
              border:"none",
              borderBottom:`2px solid ${tab===t.id?"#0EA5E9":"transparent"}`,
              color:tab===t.id?"#0EA5E9":"#0369A1",
              cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:"0.85rem",
              borderRadius:"8px 8px 0 0",
            }}>{t.label}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop:"20px" }}>
        {(!isAdmin || tab === "listen") && (
          <LanguagePicker channels={channels} selectedChannelId={selectedChannelId} onSelect={onSelectChannel} />
        )}
        {isAdmin && tab === "manage" && (
          <div style={{ padding:"0 24px 24px" }}>
            <CreateChannelForm onCreate={onCreateChannel} />
            {channels.length === 0 && (
              <p style={{ color:"#38BDF8",textAlign:"center",fontSize:"0.85rem",padding:"8px 0" }}>
                No channels yet. Create one above to get an interpreter invite link.
              </p>
            )}
            {channels.map(ch => {
              const t = adminTokens.find(x => x.channelId === ch.id);
              return <ChannelCard key={ch.id} channel={ch} token={t?.token} onDelete={onDeleteChannel} />;
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
