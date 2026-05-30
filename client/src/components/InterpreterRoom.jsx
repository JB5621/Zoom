// ============================================================
// InterpreterRoom.jsx — What the interpreter sees:
//   • Full grid of all conference participants
//   • Their own assignment badge (channel name)
//   • Mic control only (no camera — they're invisible)
//   • They can hear and speak but nobody sees their video
// ============================================================
import React, { useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "./VideoPlayer";

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

  function handleLeave() { leaveRoom(); navigate("/"); }

  if (interpreterError) return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",background:"#0a0a0f",gap:"16px",padding:"24px",textAlign:"center" }}>
      <span style={{ fontSize:"3rem" }}>⚠️</span>
      <h2 style={{ fontFamily:"'Syne',sans-serif",color:"#ef4444" }}>Cannot Join</h2>
      <p style={{ color:"#6b7280",maxWidth:"380px" }}>{interpreterError}</p>
      <button onClick={() => navigate("/")} style={{ padding:"12px 28px",
        background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:"10px",color:"#e8e8f0",cursor:"pointer",fontFamily:"inherit" }}>← Home</button>
    </div>
  );

  const cols = peerList.length <= 1 ? 1 : peerList.length <= 4 ? 2 : 3;

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:"#0a0a0f",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0 }}>
        <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:"1.2rem",
          background:"linear-gradient(135deg,#4af0c8,#0080ff)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
          ZoomClone
        </span>

        {/* Interpreter badge */}
        {myChannelInfo && (
          <div style={{ display:"flex",alignItems:"center",gap:"10px",
            background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",
            borderRadius:"12px",padding:"8px 16px" }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:"#22c55e",
              boxShadow:"0 0 8px #22c55e",animation:"pulse 1.5s infinite" }} />
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,
                color:"#4ade80",fontSize:"0.85rem" }}>
                🎙 Interpreting: {myChannelInfo.name}
              </div>
              <div style={{ color:"#6b7280",fontSize:"0.72rem" }}>
                Speak in {myChannelInfo.targetLang} — you are invisible to participants
              </div>
            </div>
          </div>
        )}

        {!isConnected && (
          <span style={{ color:"#f59e0b",fontSize:"0.82rem",fontWeight:600 }}>Connecting…</span>
        )}
      </div>

      {/* Conference grid (read-only view) */}
      <div style={{ flex:1,padding:"20px 20px 100px",overflow:"auto" }}>
        {peerList.length === 0 ? (
          <div style={{ height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
            flexDirection:"column",gap:"12px" }}>
            <span style={{ fontSize:"3rem" }}>🎧</span>
            <p style={{ color:"#374151" }}>Waiting for participants to join…</p>
          </div>
        ) : (
          <div style={{ display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"12px" }}>
            {peerList.map(([socketId, peer]) => (
              <VideoPlayer key={socketId} peerId={socketId}
                stream={peer.stream} label={peer.userName || "Participant"}
                isMuted={peer.isMuted} isVideoOff={peer.isVideoOff}
                isLocal={false} style={{ minHeight:"180px",aspectRatio:"16/9" }} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls — mic + leave only */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,
        padding:"16px 24px 28px",
        background:"linear-gradient(to top,rgba(10,10,15,0.98) 70%,transparent)",
        display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",zIndex:100 }}>

        {/* Mic status info */}
        <div style={{ position:"absolute",left:"24px",
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"10px",padding:"8px 14px" }}>
          <div style={{ color:"#6b7280",fontSize:"0.68rem",fontWeight:500 }}>MODE</div>
          <div style={{ color:"#4ade80",fontSize:"0.82rem",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>
            🎙 Interpreter
          </div>
        </div>

        {/* Mute button */}
        <button onClick={toggleMute} style={{
          display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",
          padding:"12px 20px",
          background: isMuted ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)",
          border:`1px solid ${isMuted ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)"}`,
          borderRadius:"14px",color:"#fff",cursor:"pointer",minWidth:"68px",fontFamily:"inherit",
          transition:"all 0.15s",
        }}>
          <span style={{ fontSize:"1.4rem" }}>{isMuted ? "🔇" : "🎤"}</span>
          <span style={{ fontSize:"0.68rem",color:"#9ca3af" }}>{isMuted ? "Unmute" : "Mute"}</span>
        </button>

        {/* Leave */}
        <button onClick={handleLeave} style={{
          display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",
          padding:"12px 20px",background:"#ef4444",border:"1px solid #ef4444",
          borderRadius:"14px",color:"#fff",cursor:"pointer",minWidth:"68px",fontFamily:"inherit",
        }}>
          <span style={{ fontSize:"1.4rem" }}>📵</span>
          <span style={{ fontSize:"0.68rem" }}>Leave</span>
        </button>

        {/* Participant count */}
        <div style={{ position:"absolute",right:"24px",color:"#6b7280",fontSize:"0.85rem",
          display:"flex",alignItems:"center",gap:"6px" }}>
          <span>👥</span><span>{peerList.length}</span>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
