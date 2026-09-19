// ============================================================
// InterpreterRoom.jsx — What the interpreter sees:
//   • Full grid of all conference participants
//   • Their own assignment badge (channel name)
//   • Mic control only (no camera — they're invisible)
//   • They can hear and speak but nobody sees their video
//   • They can pick one window to focus on: every other window goes
//     silent in this tab only, so the speaker they're translating
//     isn't competing with the rest of the room
// ============================================================
import React, { useMemo, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "./VideoPlayer";
import { Mic, MicOff, PhoneOff, Users, Headphones, AlertTriangle, Volume2, VolumeX } from "./icons";
import ThemeToggle from "./ThemeToggle";

export default function InterpreterRoom() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = searchParams.get("name") || user?.name || "Interpreter";

  // Join as interpreter — roomId is derived from token validation,
  // but useWebRTC handles it all via interpreterToken
  const {
    localStream, peers, interpreterError,
    isMuted, toggleMute,
    myChannelInfo, isConnected,
    leaveRoom, mySocketId,
  } = useWebRTC("INTERPRETER", userName, token);

  const peerList = useMemo(() => Object.entries(peers), [peers]);

  // The one window the interpreter is translating right now. Null means
  // "hear everyone". This never leaves the tab: it only decides which
  // tiles play audio here, so it can't mute anyone for the room.
  const [selectedPeerId, setSelectedPeerId] = useState(null);

  // Derived, not stored: if the chosen peer leaves, the focus lapses on
  // its own. Storing it would leave the whole grid silenced for someone
  // who is no longer on screen.
  const focusedPeerId = selectedPeerId && peers[selectedPeerId] ? selectedPeerId : null;
  const focusedPeer = focusedPeerId ? peers[focusedPeerId] : null;

  const toggleFocus = useCallback((socketId) => {
    setSelectedPeerId(cur => (cur === socketId ? null : socketId));
  }, []);

  function handleLeave() { leaveRoom(); navigate("/"); }

  if (interpreterError) return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",background:"var(--bg)",gap:"16px",padding:"24px",textAlign:"center" }}>
      <AlertTriangle size={48} style={{ color:"var(--danger)" }} />
      <h2 style={{ color:"var(--danger)" }}>Cannot Join</h2>
      <p style={{ color:"var(--text-2)",maxWidth:"380px" }}>{interpreterError}</p>
      <button onClick={() => navigate("/")} style={{ padding:"12px 28px",
        background:"var(--surface-1)",border:"1px solid var(--border-strong)",
        borderRadius:"8px",color:"var(--text-1)",cursor:"pointer",fontFamily:"inherit" }}>← Home</button>
    </div>
  );

  const cols = peerList.length <= 1 ? 1 : peerList.length <= 4 ? 2 : 3;

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:"var(--bg)",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"14px 24px",borderBottom:"1px solid var(--border)",background:"var(--surface-1)",flexShrink:0,flexWrap:"wrap",gap:"12px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
          <span style={{ fontWeight:800,fontSize:"1.2rem",color:"var(--text-1)" }}>
            Oguz Meeting
          </span>
          <ThemeToggle inline />
        </div>

        {/* Interpreter badge */}
        {myChannelInfo && (
          <div style={{ display:"flex",alignItems:"center",gap:"10px",
            background:"var(--success-soft)",border:"1px solid var(--success-border)",
            borderRadius:"10px",padding:"8px 16px" }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:"var(--success)",
              animation:"pulse 1.5s infinite" }} />
            <div>
              <div style={{ fontWeight:700,
                color:"var(--success-text)",fontSize:"0.85rem" }}>
                Interpreting: {myChannelInfo.name}
              </div>
              <div style={{ color:"var(--text-2)",fontSize:"0.72rem" }}>
                Speak in {myChannelInfo.targetLang} — you are invisible to participants
              </div>
            </div>
          </div>
        )}

        {!isConnected && (
          <span style={{ color:"var(--warn-text)",fontSize:"0.82rem",fontWeight:600 }}>Connecting…</span>
        )}
      </div>

      {/* Which window the interpreter is on right now */}
      {peerList.length > 0 && (
        <div style={{ display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap",
          padding:"10px 24px",borderBottom:"1px solid var(--border)",
          background: focusedPeer ? "var(--success-soft)" : "var(--surface-2)",flexShrink:0 }}>
          <span style={{ display:"flex",color: focusedPeer ? "var(--success-text)" : "var(--text-3)" }}>
            {focusedPeer ? <Volume2 size={16} /> : <Headphones size={16} />}
          </span>
          <span style={{ fontSize:"0.82rem",color:"var(--text-2)" }}>
            {focusedPeer ? (
              <>Translating <strong style={{ color:"var(--success-text)" }}>
                {focusedPeer.userName || "Participant"}</strong> — every other window is silenced for you
              </>
            ) : (
              <>Hearing everyone — click a window to translate just that person</>
            )}
          </span>
          {focusedPeer && (
            <button onClick={() => setSelectedPeerId(null)} style={{
              marginLeft:"auto",display:"flex",alignItems:"center",gap:"6px",
              padding:"6px 14px",background:"var(--surface-1)",
              border:"1px solid var(--border-strong)",borderRadius:"8px",
              color:"var(--text-1)",fontSize:"0.78rem",fontWeight:600,
              cursor:"pointer",fontFamily:"inherit",
            }}>
              <Headphones size={14} /> Hear everyone
            </button>
          )}
        </div>
      )}

      {/* Conference grid (read-only view) */}
      <div style={{ flex:1,padding:"20px 20px 100px",overflow:"auto" }}>
        {peerList.length === 0 ? (
          <div style={{ height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
            flexDirection:"column",gap:"12px" }}>
            <Headphones size={48} style={{ color:"var(--text-3)" }} />
            <p style={{ color:"var(--text-3)" }}>Waiting for participants to join…</p>
          </div>
        ) : (
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"12px" }}>
            {peerList.map(([socketId, peer]) => {
              const isFocused = focusedPeerId === socketId;
              const isSilenced = !!focusedPeerId && !isFocused;
              const name = peer.userName || "Participant";

              return (
                <div
                  key={socketId}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isFocused}
                  aria-label={isFocused
                    ? `Stop focusing on ${name} and hear everyone`
                    : `Focus audio on ${name} and silence the other windows`}
                  onClick={() => toggleFocus(socketId)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleFocus(socketId);
                    }
                  }}
                  style={{
                    position:"relative",borderRadius:"12px",cursor:"pointer",
                    outline: isFocused ? "3px solid var(--success)" : "none",
                    outlineOffset:"2px",
                    // A silenced tile still shows video — the interpreter
                    // needs to see the room — but reads as off-duty.
                    opacity: isSilenced ? 0.55 : 1,
                    transition:"opacity 160ms ease, outline-color 160ms ease",
                  }}
                >
                  <VideoPlayer peerId={socketId}
                    stream={peer.stream} label={name}
                    isMuted={peer.isMuted} isVideoOff={peer.isVideoOff}
                    audioMuted={isSilenced}
                    isLocal={false} style={{ minHeight:"180px",aspectRatio:"16/9" }} />

                  {/* Per-tile audio state, so it's obvious at a glance which
                      window is the one being translated. */}
                  <div style={{
                    position:"absolute",top:"10px",left:"10px",
                    display:"flex",alignItems:"center",gap:"5px",
                    background: isFocused ? "var(--success)" : "var(--chip-dark)",
                    border:`1px solid ${isFocused ? "var(--success)" : "var(--border)"}`,
                    borderRadius:"6px",padding:"3px 8px",
                    color: isFocused ? "var(--on-accent)" : "#fff",
                    fontSize:"0.65rem",fontWeight:700,letterSpacing:"0.05em",
                    pointerEvents:"none",
                  }}>
                    {isFocused
                      ? <><Volume2 size={12} /><span>TRANSLATING</span></>
                      : isSilenced
                        ? <><VolumeX size={12} /><span>SILENCED</span></>
                        : <span>CLICK TO FOCUS</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom controls — mic + leave only */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,
        padding:"16px 24px 28px",
        background:"var(--surface-1)",borderTop:"1px solid var(--border)",
        display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",zIndex:100 }}>

        {/* Mic status info */}
        <div style={{ position:"absolute",left:"24px",
          background:"var(--surface-2)",border:"1px solid var(--border)",
          borderRadius:"10px",padding:"8px 14px" }}>
          <div style={{ color:"var(--text-2)",fontSize:"0.68rem",fontWeight:500 }}>MODE</div>
          <div style={{ color:"var(--success-text)",fontSize:"0.82rem",fontWeight:700 }}>
            {focusedPeer ? "Focused" : "Interpreter"}
          </div>
        </div>

        {/* Mute button */}
        <button onClick={toggleMute} style={{
          display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",
          padding:"12px 20px",
          background: isMuted ? "var(--danger-soft)" : "var(--surface-2)",
          border:`1px solid ${isMuted ? "var(--danger-border)" : "var(--border)"}`,
          borderRadius:"10px",color:"var(--text-1)",cursor:"pointer",minWidth:"68px",fontFamily:"inherit",
        }}>
          <span style={{ display:"flex" }}>{isMuted ? <MicOff /> : <Mic />}</span>
          <span style={{ fontSize:"0.68rem",color:"var(--text-2)" }}>{isMuted ? "Unmute" : "Mute"}</span>
        </button>

        {/* Leave */}
        <button onClick={handleLeave} style={{
          display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",
          padding:"12px 20px",background:"var(--danger)",border:"1px solid var(--danger)",
          borderRadius:"10px",color:"var(--on-accent)",cursor:"pointer",minWidth:"68px",fontFamily:"inherit",
        }}>
          <span style={{ display:"flex" }}><PhoneOff /></span>
          <span style={{ fontSize:"0.68rem" }}>Leave</span>
        </button>

        {/* Participant count */}
        <div style={{ position:"absolute",right:"24px",color:"var(--text-2)",fontSize:"0.85rem",
          display:"flex",alignItems:"center",gap:"6px" }}>
          <Users size={16} /><span>{peerList.length}</span>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
