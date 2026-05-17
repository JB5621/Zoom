// ============================================================
// Controls.jsx — Bottom toolbar: mic, camera, screen, leave
// ============================================================
import React from "react";

function Btn({ onClick, active, danger, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "clamp(2px, 1vw, 4px)",
        padding: "clamp(10px, 2vw, 12px) clamp(12px, 3vw, 18px)",
        background: danger
          ? "linear-gradient(135deg, #ef4444, #f87171)"
          : active
          ? "rgba(0,128,255,0.2)"
          : "rgba(255,255,255,0.06)",
        border: "1.5px solid",
        borderColor: danger
          ? "#f87171"
          : active
          ? "rgba(0,200,255,0.4)"
          : "rgba(255,255,255,0.12)",
        borderRadius: "clamp(10px, 2vw, 14px)",
        color: "#fff",
        cursor: "pointer",
        transition: "all 0.2s ease",
        minWidth: "clamp(44px, 10vw, 66px)",
        minHeight: "44px",
        fontFamily: "inherit",
        fontSize: "clamp(0.8rem, 1.5vw, 0.95rem)",
        boxShadow: danger
          ? "0 4px 12px rgba(239,68,68,0.2)"
          : active
          ? "0 4px 12px rgba(0,200,255,0.15)"
          : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = danger
          ? "0 8px 20px rgba(239,68,68,0.3)"
          : active
          ? "0 8px 20px rgba(0,200,255,0.25)"
          : "0 8px 20px rgba(0,128,255,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = danger
          ? "0 4px 12px rgba(239,68,68,0.2)"
          : active
          ? "0 4px 12px rgba(0,200,255,0.15)"
          : "none";
      }}
    >
      <span style={{ fontSize: "clamp(1rem, 3vw, 1.4rem)", lineHeight: 1 }}>{children}</span>
    </button>
  );
}

export default function Controls({
  isMuted, isVideoOff, isSharingScreen, showChat,
  isRecording, isInterpreterActive,
  onToggleMute, onToggleVideo, onToggleScreen,
  onToggleChat, onOpenSettings, onToggleRecord,
  onOpenInterpretation, onLeave,
  participantCount, roomId,
}) {
  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "clamp(12px, 3vw, 16px) clamp(12px, 5vw, 24px) clamp(16px, 4vw, 24px)",
        background:
          "linear-gradient(to top, rgba(10,10,15,0.99) 60%, rgba(10,10,15,0.8) 80%, transparent)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(6px, 2vw, 10px)",
        zIndex: 100,
        borderTop: "1px solid rgba(0,128,255,0.1)",
        flexWrap: "wrap",
      }}
    >
      {/* Room code badge - hidden on small screens */}
      <div
        onClick={copyLink}
        title="Click to copy meeting link"
        style={{
          position: window.innerWidth < 640 ? "static" : "absolute",
          left: "clamp(12px, 3vw, 24px)",
          background: "rgba(0,128,255,0.1)",
          border: "1.5px solid rgba(0,200,255,0.3)",
          borderRadius: "clamp(8px, 2vw, 12px)",
          padding: "clamp(6px, 1.5vw, 10px) clamp(10px, 2vw, 16px)",
          cursor: "pointer",
          display: window.innerWidth < 640 ? "none" : "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(0,128,255,0.2)";
          e.currentTarget.style.borderColor = "rgba(0,200,255,0.5)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,128,255,0.1)";
          e.currentTarget.style.borderColor = "rgba(0,200,255,0.3)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <span style={{ color: "#6b7280", fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)", fontWeight: 600, letterSpacing: "0.05em" }}>
          📍 ROOM
        </span>
        <span
          style={{
            color: "#60b4ff",
            fontSize: "clamp(0.75rem, 1.5vw, 0.88rem)",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            letterSpacing: "0.15em",
            marginTop: "clamp(2px, 0.5vw, 4px)",
          }}
        >
          {roomId}
        </span>
      </div>

      {/* Center controls */}
      <Btn onClick={onToggleMute} active={isMuted} title={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? "🔇" : "🎤"}
      </Btn>

      <Btn onClick={onToggleVideo} active={isVideoOff} title={isVideoOff ? "Start Video" : "Stop Video"}>
        {isVideoOff ? "📵" : "📹"}
      </Btn>

      <Btn onClick={onToggleScreen} active={isSharingScreen} title={isSharingScreen ? "Stop Sharing" : "Share Screen"}>
        {isSharingScreen ? "🖥️" : "📺"}
      </Btn>

      <Btn onClick={onToggleChat} active={showChat} title="Chat">
        💬
      </Btn>

      <Btn onClick={onOpenSettings} title="Audio & Video Settings">
        ⚙️
      </Btn>

      <Btn onClick={onToggleRecord} active={isRecording} title={isRecording ? "Stop Recording" : "Start Recording"}>
        {isRecording ? "⏹" : "⏺"}
      </Btn>

      <Btn onClick={onOpenInterpretation} active={isInterpreterActive} title="Language Interpretation">
        🌐
      </Btn>

      <Btn onClick={onLeave} danger title="Leave Meeting">
        📵
      </Btn>

      {/* Participant count */}
      <div
        style={{
          position: window.innerWidth < 640 ? "static" : "absolute",
          right: "clamp(12px, 3vw, 24px)",
          display: "flex",
          alignItems: "center",
          gap: "clamp(4px, 1vw, 6px)",
          color: "#6b7280",
          fontSize: "clamp(0.75rem, 2vw, 0.85rem)",
          background: window.innerWidth < 640 ? "rgba(255,255,255,0.05)" : "transparent",
          padding: window.innerWidth < 640 ? "clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px)" : "0",
          borderRadius: window.innerWidth < 640 ? "clamp(6px, 1.5vw, 8px)" : "0",
          border: window.innerWidth < 640 ? "1px solid rgba(255,255,255,0.08)" : "none",
        }}
      >
        <span>👥</span>
        <span>{participantCount}</span>
      </div>
    </div>
  );
}
