// ============================================================
// VideoPlayer.jsx — video tile with optional admin crown badge
// ============================================================
import React, { useRef, useEffect } from "react";

export default function VideoPlayer({ stream, label, isMuted, isVideoOff, isLocal, isAdmin, peerId, style, speakerId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  // Apply speaker output to this video element
  useEffect(() => {
    if (videoRef.current && speakerId && videoRef.current.setSinkId) {
      videoRef.current.setSinkId(speakerId).catch(e => 
        console.warn("setSinkId not supported or failed:", e)
      );
    }
  }, [speakerId]);

  const initials = (label || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      position:"relative", background:"#111118", borderRadius:"clamp(8px, 2vw, 16px)",
      overflow:"hidden", border: isAdmin
        ? "2px solid rgba(251,191,36,0.6)"
        : "1px solid rgba(255,255,255,0.06)",
      display:"flex", alignItems:"center", justifyContent:"center",
      boxShadow: isAdmin ? "0 0 20px rgba(251,191,36,0.15)" : "none",
      ...style,
    }}>
      <video
        ref={videoRef}
        autoPlay playsInline
        muted={isLocal}
        data-peer-id={!isLocal && peerId ? peerId : undefined}
        style={{
          width:"100%", height:"100%", objectFit:"cover",
          display: isVideoOff ? "none" : "block",
          transform: isLocal ? "scaleX(-1)" : "none",
        }}
      />

      {/* Avatar when video is off */}
      {isVideoOff && (
        <div style={{
          width:"clamp(48px, 15vw, 72px)", height:"clamp(48px, 15vw, 72px)", borderRadius:"50%",
          background:"linear-gradient(135deg,#0080ff,#4af0c8)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"clamp(1rem, 3vw, 1.6rem)", color:"#fff",
        }}>
          {initials}
        </div>
      )}

      {/* 👑 Admin crown — top-right corner */}
      {isAdmin && (
        <div style={{
          position:"absolute", top:"clamp(6px, 2vw, 10px)", right:"clamp(6px, 2vw, 10px)",
          background:"rgba(0,0,0,0.65)", backdropFilter:"blur(6px)",
          border:"1px solid rgba(251,191,36,0.5)",
          borderRadius:"clamp(6px, 1.5vw, 8px)", padding:"clamp(2px, 1vw, 3px) clamp(5px, 1.5vw, 8px)",
          display:"flex", alignItems:"center", gap:"clamp(3px, 1vw, 5px)",
        }}>
          <span style={{ fontSize:"clamp(0.65rem, 2vw, 0.85rem)" }}>👑</span>
          <span style={{
            color:"#fbbf24", fontSize:"clamp(0.55rem, 1.5vw, 0.68rem)", fontWeight:700,
            fontFamily:"'Syne',sans-serif", letterSpacing:"0.06em",
          }}>ADMIN</span>
        </div>
      )}

      {/* Bottom label bar */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0,
        padding:"clamp(16px, 4vw, 28px) clamp(8px, 2vw, 14px) clamp(6px, 2vw, 12px)",
        background:"linear-gradient(to top,rgba(0,0,0,0.8),transparent)",
        display:"flex", alignItems:"center", gap:"clamp(4px, 1vw, 8px)",
      }}>
        <span style={{
          color:"#fff", fontSize:"clamp(0.7rem, 2vw, 0.82rem)", fontWeight:500,
          textShadow:"0 1px 3px rgba(0,0,0,0.5)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>
          {label || "Unknown"}{isLocal && " (You)"}
        </span>
        {isAdmin && (
          <span style={{ fontSize:"clamp(0.6rem, 1.5vw, 0.75rem)" }}>👑</span>
        )}
        {isMuted && (
          <span style={{
            marginLeft:"auto", background:"#ef4444", borderRadius:"clamp(4px, 1vw, 6px)",
            padding:"clamp(1px, 0.5vw, 2px) clamp(4px, 1vw, 7px)", fontSize:"clamp(0.6rem, 1.5vw, 0.7rem)", 
            color:"#fff", fontWeight:600, flexShrink:0,
          }}>MUTED</span>
        )}
      </div>
    </div>
  );
}
