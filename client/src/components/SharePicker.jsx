// ============================================================
// SharePicker.jsx — Modal to choose what to share:
//   • Entire Screen
//   • Application Window
//   • Browser Tab
// ============================================================
import React, { useEffect } from "react";

const OPTIONS = [
  {
    id: "monitor",
    icon: "🖥️",
    title: "Entire Screen",
    desc: "Share everything on your display",
    constraints: {
      video: { displaySurface: "monitor", cursor: "always" },
      audio: false,
    },
  },
  {
    id: "window",
    icon: "🪟",
    title: "Application Window",
    desc: "Share one app — others stay private",
    constraints: {
      video: { displaySurface: "window", cursor: "always" },
      audio: false,
    },
  },
  {
    id: "browser",
    icon: "🌐",
    title: "Browser Tab",
    desc: "Share a specific tab with audio",
    constraints: {
      video: { displaySurface: "browser" },
      audio: true,
    },
  },
];

export default function SharePicker({ onShare, onClose }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handlePick(option) {
    try {
      // displaySurface hint tells the browser to pre-select the right tab
      // in the picker UI, but the user can still change it
      const stream = await navigator.mediaDevices.getDisplayMedia(
        option.constraints
      );
      onShare(stream, option.id);
    } catch (e) {
      if (e.name !== "NotAllowedError") {
        console.error("getDisplayMedia error:", e);
      }
      // User cancelled — just close
      onClose();
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#0f0f1a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "22px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "22px 24px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#e8e8f0",
              }}
            >
              Share Your Screen
            </div>
            <div style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: "3px" }}>
              Choose what to show participants
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#9ca3af",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handlePick(opt)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                color: "#e8e8f0",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,128,255,0.12)";
                e.currentTarget.style.borderColor = "rgba(0,128,255,0.35)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span
                style={{
                  fontSize: "2rem",
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  flexShrink: 0,
                }}
              >
                {opt.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "#e8e8f0",
                    marginBottom: "3px",
                  }}
                >
                  {opt.title}
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.82rem" }}>
                  {opt.desc}
                </div>
              </div>
              <span style={{ color: "#4b5563", fontSize: "1.1rem" }}>›</span>
            </button>
          ))}

          <p
            style={{
              color: "#374151",
              fontSize: "0.75rem",
              textAlign: "center",
              marginTop: "4px",
            }}
          >
            Your browser will show a permission dialog next
          </p>
        </div>
      </div>
    </div>
  );
}
