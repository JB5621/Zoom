// ============================================================
// Home.jsx — Landing page: create or join a meeting
// ============================================================
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const S = {
  page: {
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f1a 100%)",
    padding: "clamp(16px, 5vw, 24px)",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  logo: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 800,
    fontSize: "clamp(1.75rem, 8vw, 3.5rem)",
    letterSpacing: "-0.03em",
    background: "linear-gradient(135deg, #4af0c8 0%, #0080ff 50%, #00d4ff 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "clamp(8px, 2vw, 12px)",
    animation: "fadeInUp 0.8s ease-out",
  },
  tagline: {
    color: "#9ca3af",
    fontSize: "clamp(0.9rem, 4vw, 1.1rem)",
    fontWeight: 400,
    marginBottom: "clamp(32px, 8vw, 56px)",
    textAlign: "center",
    maxWidth: "90vw",
    animation: "fadeInUp 0.8s ease-out 0.1s backwards",
  },
  card: {
    background: "rgba(15,15,26,0.6)",
    border: "1px solid rgba(0,128,255,0.15)",
    borderRadius: "clamp(16px, 4vw, 28px)",
    padding: "clamp(24px, 6vw, 48px)",
    width: "100%",
    maxWidth: "min(480px, 90vw)",
    backdropFilter: "blur(30px)",
    boxShadow: "0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
    animation: "fadeInUp 0.8s ease-out 0.2s backwards",
  },
  nameInput: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1.5px solid rgba(0,128,255,0.2)",
    borderRadius: "clamp(10px, 3vw, 14px)",
    padding: "clamp(12px, 3vw, 16px) clamp(14px, 3vw, 20px)",
    color: "#e8e8f0",
    fontSize: "clamp(0.875rem, 3vw, 0.95rem)",
    outline: "none",
    transition: "all 0.3s ease",
    marginBottom: "clamp(12px, 3vw, 20px)",
    fontFamily: "inherit",
  },
  nameInputFocus: {
    borderColor: "rgba(0,200,255,0.6)",
    boxShadow: "0 0 0 3px rgba(0,200,255,0.1)",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(8px, 2vw, 12px)",
    margin: "clamp(16px, 4vw, 28px) 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(0,128,255,0.2) 50%, rgba(255,255,255,0) 100%)",
  },
  dividerText: {
    color: "#4b5563",
    fontSize: "clamp(0.65rem, 2vw, 0.75rem)",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 600,
  },
  btnPrimary: {
    width: "100%",
    padding: "clamp(14px, 3vw, 16px)",
    background: "linear-gradient(135deg, #0080ff 0%, #00c8ff 100%)",
    border: "none",
    borderRadius: "clamp(10px, 3vw, 14px)",
    color: "#fff",
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: "clamp(0.875rem, 3vw, 0.95rem)",
    cursor: "pointer",
    letterSpacing: "0.02em",
    transition: "all 0.3s ease",
    marginBottom: "clamp(10px, 2vw, 14px)",
    boxShadow: "0 10px 30px rgba(0,128,255,0.25)",
    minHeight: "44px",
  },
  joinRow: {
    display: "flex",
    gap: "clamp(6px, 2vw, 10px)",
    flexWrap: "wrap",
  },
  joinInput: {
    flex: 1,
    minWidth: "clamp(120px, 100%, 200px)",
    background: "rgba(255,255,255,0.06)",
    border: "1.5px solid rgba(0,128,255,0.2)",
    borderRadius: "clamp(10px, 3vw, 14px)",
    padding: "clamp(12px, 3vw, 16px) clamp(14px, 3vw, 20px)",
    color: "#e8e8f0",
    fontSize: "clamp(0.875rem, 3vw, 0.95rem)",
    outline: "none",
    fontFamily: "inherit",
    letterSpacing: "0.1em",
    transition: "all 0.3s ease",
  },
  btnSecondary: {
    padding: "clamp(12px, 3vw, 16px) clamp(16px, 3vw, 24px)",
    background: "rgba(0,128,255,0.1)",
    border: "1.5px solid rgba(0,128,255,0.3)",
    borderRadius: "clamp(10px, 3vw, 14px)",
    color: "#60b4ff",
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.3s ease",
    minHeight: "44px",
    minWidth: "44px",
  },
  label: {
    color: "#9ca3af",
    fontSize: "clamp(0.7rem, 2vw, 0.8rem)",
    marginBottom: "clamp(6px, 2vw, 10px)",
    display: "block",
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  error: {
    color: "#ff6b6b",
    fontSize: "clamp(0.75rem, 2vw, 0.85rem)",
    marginTop: "clamp(10px, 2vw, 16px)",
    textAlign: "center",
    padding: "clamp(10px, 2vw, 12px) clamp(12px, 2vw, 16px)",
    background: "rgba(255,107,107,0.1)",
    borderRadius: "clamp(8px, 2vw, 10px)",
    border: "1px solid rgba(255,107,107,0.2)",
  },
};

export default function Home() {
  const [userName, setUserName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleCreate() {
    if (!userName.trim()) return setError("Please enter your name first.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const { roomId } = await res.json();
      navigate(`/room/${roomId}?name=${encodeURIComponent(userName.trim())}`);
    } catch {
      setError("Failed to create room. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!userName.trim()) return setError("Please enter your name first.");
    const code = roomCode.trim().toUpperCase();
    if (!code) return setError("Please enter a room code.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) return setError("Room not found. Check the code and try again.");
      navigate(`/room/${code}?name=${encodeURIComponent(userName.trim())}`);
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      {/* Background glows */}
      <div style={{ ...S.glow, width: 400, height: 400, background: "rgba(0,128,255,0.15)", top: -100, right: -100 }} />
      <div style={{ ...S.glow, width: 350, height: 350, background: "rgba(0,200,255,0.1)", bottom: -80, left: -80 }} />

      <div style={S.logo}>ZoomClone</div>
      <p style={S.tagline}>Crystal-clear video meetings with built-in interpretation.</p>

      <div style={S.card}>
        <label style={S.label}>Your Name</label>
        <input
          style={S.nameInput}
          placeholder="e.g. Alex Johnson"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          onFocus={(e) => Object.assign(e.target.style, S.nameInputFocus)}
          onBlur={(e) => (e.target.style.borderColor = "rgba(0,128,255,0.2)", e.target.style.boxShadow = "none")}
        />

        <button
          style={S.btnPrimary}
          onClick={handleCreate}
          disabled={loading}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 15px 40px rgba(0,128,255,0.35)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 10px 30px rgba(0,128,255,0.25)";
          }}
        >
          {loading ? "⏳ Creating..." : "✨ New Meeting"}
        </button>

        <div style={S.divider}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>or join existing</span>
          <div style={S.dividerLine} />
        </div>

        <label style={S.label}>Room Code</label>
        <div style={S.joinRow}>
          <input
            style={S.joinInput}
            placeholder="e.g. A3F9B21C"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            onFocus={(e) => (e.target.style.borderColor = "rgba(0,200,255,0.6)", e.target.style.boxShadow = "0 0 0 3px rgba(0,200,255,0.1)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(0,128,255,0.2)", e.target.style.boxShadow = "none")}
            maxLength={8}
          />
          <button
            style={S.btnSecondary}
            onClick={handleJoin}
            disabled={loading}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(0,128,255,0.2)";
              e.target.style.borderColor = "rgba(0,200,255,0.5)";
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(0,128,255,0.1)";
              e.target.style.borderColor = "rgba(0,128,255,0.3)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            Join →
          </button>
        </div>

        {error && <div style={S.error}>⚠️ {error}</div>}
      </div>

      <p style={{ color: "#4b5563", fontSize: "0.78rem", marginTop: "40px", textAlign: "center" }}>
        🚀 Powered by WebRTC · 🔐 No account needed
      </p>
    </div>
  );
}
