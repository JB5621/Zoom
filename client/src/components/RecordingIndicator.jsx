// ============================================================
// RecordingIndicator.jsx — Floating badge while recording
// Shows: red dot + timer + pause + stop buttons
// ============================================================
import React from "react";

export default function RecordingIndicator({
  isRecording,
  isPaused,
  durationLabel,
  onPause,
  onStop,
}) {
  if (!isRecording) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "clamp(50px, 10vh, 70px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        gap: "clamp(6px, 1.5vw, 10px)",
        background: "rgba(10,10,20,0.92)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${isPaused ? "rgba(251,146,60,0.5)" : "rgba(239,68,68,0.5)"}`,
        borderRadius: "clamp(10px, 2vw, 14px)",
        padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 14px) clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)",
        boxShadow: `0 8px 32px ${isPaused ? "rgba(251,146,60,0.2)" : "rgba(239,68,68,0.25)"}`,
        animation: "slideDown 0.25s ease",
        flexWrap: "wrap",
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>

      {/* Pulsing dot */}
      <div
        style={{
          width: "clamp(8px, 1.5vw, 10px)",
          height: "clamp(8px, 1.5vw, 10px)",
          borderRadius: "50%",
          background: isPaused ? "#fb923c" : "#ef4444",
          flexShrink: 0,
          animation: isPaused ? "none" : "blink 1.2s ease infinite",
          boxShadow: isPaused ? "0 0 6px #fb923c" : "0 0 8px #ef4444",
        }}
      />

      {/* Label */}
      <span
        style={{
          color: "#e8e8f0",
          fontSize: "clamp(0.7rem, 1.5vw, 0.82rem)",
          fontWeight: 600,
          fontFamily: "'Syne', sans-serif",
          letterSpacing: "0.03em",
        }}
      >
        {isPaused ? "PAUSED" : "REC"}
      </span>

      {/* Timer */}
      <span
        style={{
          color: isPaused ? "#fb923c" : "#ef4444",
          fontSize: "clamp(0.75rem, 1.5vw, 0.88rem)",
          fontWeight: 700,
          fontFamily: "monospace",
          minWidth: "clamp(30px, 5vw, 44px)",
        }}
      >
        {durationLabel}
      </span>

      <div style={{ width: 1, height: "clamp(14px, 2vw, 18px)", background: "rgba(255,255,255,0.12)" }} />

      {/* Pause / Resume */}
      <button
        onClick={onPause}
        title={isPaused ? "Resume recording" : "Pause recording"}
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "clamp(6px, 1.5vw, 8px)",
          color: "#e8e8f0",
          padding: "clamp(3px, 1vw, 4px) clamp(6px, 1.5vw, 10px)",
          cursor: "pointer",
          fontSize: "clamp(0.7rem, 1.5vw, 0.8rem)",
          fontWeight: 500,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: "clamp(2px, 0.5vw, 4px)",
          transition: "background 0.15s",
          minHeight: "44px",
          minWidth: "44px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        {isPaused ? "▶ Resume" : "⏸ Pause"}
      </button>

      {/* Stop & download */}
      <button
        onClick={onStop}
        title="Stop recording and download"
        style={{
          background: "#ef4444",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "clamp(6px, 1.5vw, 8px)",
          color: "#fff",
          padding: "clamp(3px, 1vw, 4px) clamp(8px, 1.5vw, 12px)",
          cursor: "pointer",
          fontSize: "clamp(0.7rem, 1.5vw, 0.8rem)",
          fontWeight: 600,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: "clamp(3px, 1vw, 5px)",
          transition: "opacity 0.15s",
          minHeight: "44px",
          minWidth: "44px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        ⏹ Stop & Save
      </button>
    </div>
  );
}
