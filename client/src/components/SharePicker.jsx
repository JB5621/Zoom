// ============================================================
// SharePicker.jsx — Modal to choose what to share:
//   • Entire Screen
//   • Application Window
//   • Browser Tab
// ============================================================
import React, { useEffect } from "react";
import { Monitor, AppWindow, Globe } from "./icons";

const OPTIONS = [
  {
    id: "monitor",
    icon: <Monitor size={24} />,
    title: "Entire Screen",
    desc: "Share everything on your display",
    constraints: {
      video: { displaySurface: "monitor", cursor: "always" },
      audio: false,
    },
  },
  {
    id: "window",
    icon: <AppWindow size={24} />,
    title: "Application Window",
    desc: "Share one app — others stay private",
    constraints: {
      video: { displaySurface: "window", cursor: "always" },
      audio: false,
    },
  },
  {
    id: "browser",
    icon: <Globe size={24} />,
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
        background: "rgba(12,74,110,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #BAE6FD",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "22px 24px 18px",
            borderBottom: "1px solid #BAE6FD",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#0C4A6E",
              }}
            >
              Share Your Screen
            </div>
            <div style={{ color: "#0369A1", fontSize: "0.78rem", marginTop: "3px" }}>
              Choose what to show participants
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#E0F2FE",
              border: "1px solid #BAE6FD",
              borderRadius: "8px",
              color: "#0369A1",
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
                background: "#FFFFFF",
                border: "1px solid #BAE6FD",
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                color: "#0C4A6E",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#F0F9FF";
                e.currentTarget.style.borderColor = "#BAE6FD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.borderColor = "#BAE6FD";
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#E0F2FE",
                  borderRadius: "10px",
                  flexShrink: 0,
                  color: "#0EA5E9",
                }}
              >
                {opt.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "#0C4A6E",
                    marginBottom: "3px",
                  }}
                >
                  {opt.title}
                </div>
                <div style={{ color: "#0369A1", fontSize: "0.82rem" }}>
                  {opt.desc}
                </div>
              </div>
              <span style={{ color: "#38BDF8", fontSize: "1.1rem" }}>›</span>
            </button>
          ))}

          <p
            style={{
              color: "#38BDF8",
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
