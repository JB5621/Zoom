// ============================================================
// VideoPlayer.jsx — video tile with optional admin crown badge
// ============================================================
import React, { useRef, useEffect } from "react";

function VideoPlayer({ stream, label, isMuted, isVideoOff, isLocal, isAdmin, peerId, style, speakerId }) {
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
      position:"relative", background:"#18181D", borderRadius:"10px",
      overflow:"hidden", border: isAdmin
        ? "2px solid #F59E0B"
        : "1px solid rgba(255,255,255,0.08)",
      display:"flex", alignItems:"center", justifyContent:"center",
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
          background:"#0EA5E9",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontWeight:700, fontSize:"clamp(1rem, 3vw, 1.6rem)", color:"#fff",
        }}>
          {initials}
        </div>
      )}

      {/* Admin badge — top-right corner */}
      {isAdmin && (
        <div style={{
          position:"absolute", top:"clamp(6px, 2vw, 10px)", right:"clamp(6px, 2vw, 10px)",
          background:"rgba(0,0,0,0.6)",
          border:"1px solid rgba(245,158,11,0.5)",
          borderRadius:"6px", padding:"clamp(2px, 1vw, 3px) clamp(5px, 1.5vw, 8px)",
          display:"flex", alignItems:"center", gap:"clamp(3px, 1vw, 5px)",
        }}>
          <span style={{
            color:"#F59E0B", fontSize:"clamp(0.55rem, 1.5vw, 0.68rem)", fontWeight:700,
            letterSpacing:"0.06em",
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
          <span style={{ color:"#F59E0B", fontSize:"clamp(0.6rem, 1.5vw, 0.7rem)", fontWeight:700 }}>ADMIN</span>
        )}
        {isMuted && (
          <span style={{
            marginLeft:"auto", background:"#DC2626", borderRadius:"clamp(4px, 1vw, 6px)",
            padding:"clamp(1px, 0.5vw, 2px) clamp(4px, 1vw, 7px)", fontSize:"clamp(0.6rem, 1.5vw, 0.7rem)", 
            color:"#fff", fontWeight:600, flexShrink:0,
          }}>MUTED</span>
        )}
      </div>
    </div>
  );
}

export default React.memo(VideoPlayer);
