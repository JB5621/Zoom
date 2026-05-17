// ============================================================
// InterpreterJoin.jsx — Entry page for interpreters
// Opened via invite link: /interpreter?token=xxxx
// Validates the token then redirects to /interpreter/:token
// ============================================================
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function InterpreterJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [channelInfo, setChannelInfo] = useState(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("No invite token found in link."); setLoading(false); return; }
    fetch(`/api/interpreter-token/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setChannelInfo(data); setLoading(false); })
      .catch(() => { setError("This invite link is invalid or has expired."); setLoading(false); });
  }, [token]);

  function handleJoin() {
    if (!userName.trim()) return setError("Please enter your name.");
    navigate(`/interpreter/${token}?name=${encodeURIComponent(userName.trim())}`);
  }

  const S = {
    page: {
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#0a0a0f,#0d0d1a,#0a0f1a)",
      padding: "24px",
    },
    card: {
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "24px", padding: "40px", width: "100%", maxWidth: "420px",
      backdropFilter: "blur(20px)", boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
      textAlign: "center",
    },
    logo: {
      fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "1.5rem",
      background: "linear-gradient(135deg,#4af0c8,#0080ff)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      marginBottom: "24px",
    },
    badge: {
      display: "inline-flex", alignItems: "center", gap: "8px",
      background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
      borderRadius: "12px", padding: "10px 18px", marginBottom: "24px",
    },
    input: {
      width: "100%", background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
      padding: "14px 18px", color: "#e8e8f0", fontSize: "0.95rem",
      outline: "none", fontFamily: "inherit", marginBottom: "14px", boxSizing: "border-box",
    },
    btn: {
      width: "100%", padding: "14px",
      background: "linear-gradient(135deg,#22c55e,#16a34a)",
      border: "none", borderRadius: "12px", color: "#fff",
      fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: "0.95rem",
      cursor: "pointer",
    },
    error: { color: "#f87171", fontSize: "0.85rem", marginTop: "12px" },
  };

  if (loading) return (
    <div style={S.page}>
      <div style={{ ...S.card, color: "#6b7280" }}>Validating invite link…</div>
    </div>
  );

  if (error && !channelInfo) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>ZoomClone</div>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>❌</div>
        <p style={{ color: "#f87171", marginBottom: "8px", fontWeight: 600 }}>Invalid Invite Link</p>
        <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>ZoomClone</div>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎙</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", color: "#e8e8f0", marginBottom: "8px", fontSize: "1.2rem" }}>
          Interpreter Invite
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "20px" }}>
          You've been invited to interpret for this meeting
        </p>

        {channelInfo && (
          <div style={S.badge}>
            <span style={{ fontSize: "1rem" }}>🌐</span>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#4ade80", fontSize: "0.9rem" }}>
              {channelInfo.channelName}
            </span>
          </div>
        )}

        <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginBottom: "20px" }}>
          You will hear the entire conference but will <strong style={{ color: "#e8e8f0" }}>not be visible</strong> in the main grid.
          Speak in <strong style={{ color: "#4ade80" }}>{channelInfo?.targetLang}</strong> and participants who select your channel will hear you.
        </p>

        <input
          style={S.input}
          placeholder="Your interpreter name"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          onFocus={e => e.target.style.borderColor = "rgba(34,197,94,0.5)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
        />
        <button style={S.btn} onClick={handleJoin}>
          Join as Interpreter →
        </button>
        {error && <div style={S.error}>{error}</div>}
      </div>
    </div>
  );
}
