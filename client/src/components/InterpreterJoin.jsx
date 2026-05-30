// ============================================================
// InterpreterJoin.jsx — Entry page for interpreters
// Opened via invite link: /interpreter?token=xxxx
// Validates the token then redirects to /interpreter/:token
// ============================================================
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function InterpreterJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { user } = useAuth();

  const [channelInfo, setChannelInfo] = useState(null);
  const [userName, setUserName] = useState(user?.name || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("No invite token found in link."); setLoading(false); return; }
    fetch(`/api/interpreter-token/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setChannelInfo(data); setLoading(false); })
      .catch(() => { setError("This invite link is invalid or has expired."); setLoading(false); });
  }, [token]);

  useEffect(() => {
    if (user?.name && !userName) {
      setUserName(user.name);
    }
  }, [user, userName]);

  function handleJoin() {
    if (!userName.trim()) return setError("Please enter your name.");
    navigate(`/interpreter/${token}?name=${encodeURIComponent(userName.trim())}`);
  }

  const S = {
    page: {
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,var(--light-6),var(--accent-2),var(--light-7))",
      padding: "24px",
    },
    card: {
      background: "rgba(255,255,255,0.82)", border: "1px solid var(--light-4)",
      borderRadius: "24px", padding: "40px", width: "100%", maxWidth: "420px",
      backdropFilter: "blur(20px)", boxShadow: "0 25px 60px rgba(90,106,133,0.18)",
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
      background: "var(--accent-4)", border: "1px solid var(--light-4)",
      borderRadius: "12px", padding: "10px 18px", marginBottom: "24px",
    },
    input: {
      width: "100%", background: "var(--light-7)",
      border: "1px solid var(--light-4)", borderRadius: "12px",
      padding: "14px 18px", color: "var(--light-1)", fontSize: "0.95rem",
      outline: "none", fontFamily: "inherit", marginBottom: "14px", boxSizing: "border-box",
    },
    btn: {
      width: "100%", padding: "14px",
      background: "linear-gradient(135deg,var(--accent-3),var(--accent-1))",
      border: "none", borderRadius: "12px", color: "var(--light-7)",
      fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: "0.95rem",
      cursor: "pointer",
    },
    error: { color: "var(--text-2)", fontSize: "0.85rem", marginTop: "12px" },
  };

  if (loading) return (
    <div style={S.page}>
      <div style={{ ...S.card, color: "var(--light-2)" }}>Validating invite link…</div>
    </div>
  );

  if (error && !channelInfo) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>ZoomClone</div>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>❌</div>
        <p style={{ color: "var(--text-2)", marginBottom: "8px", fontWeight: 600 }}>Invalid Invite Link</p>
        <p style={{ color: "var(--light-2)", fontSize: "0.85rem" }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>ZoomClone</div>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎙</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", color: "var(--text-1)", marginBottom: "8px", fontSize: "1.2rem" }}>
          Interpreter Invite
        </h2>
        <p style={{ color: "var(--light-2)", fontSize: "0.85rem", marginBottom: "20px" }}>
          You've been invited to interpret for this meeting
        </p>

        {channelInfo && (
          <div style={S.badge}>
            <span style={{ fontSize: "1rem" }}>🌐</span>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--light-1)", fontSize: "0.9rem" }}>
              {channelInfo.channelName}
            </span>
          </div>
        )}

        <p style={{ color: "var(--light-3)", fontSize: "0.8rem", marginBottom: "20px" }}>
          You will hear the entire conference but will <strong style={{ color: "var(--text-1)" }}>not be visible</strong> in the main grid.
          Speak in <strong style={{ color: "var(--text-1)" }}>{channelInfo?.targetLang}</strong> and participants who select your channel will hear you.
        </p>

        <input
          style={S.input}
          placeholder="Your interpreter name"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          onFocus={e => e.target.style.borderColor = "var(--accent-3)"}
          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
          onInput={e => e.target.style.color = 'var(--text-1)'}
        />
        <button
          style={{ ...S.btn, background: 'linear-gradient(135deg, var(--accent-3) 0%, var(--accent-1) 100%)' }}
          onClick={handleJoin}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--light-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-3) 0%, var(--accent-1) 100%)'; e.currentTarget.style.color = 'var(--light-7)'; }}
        >
          Join as Interpreter →
        </button>
        {error && <div style={{ ...S.error, color: 'var(--text-2)' }}>{error}</div>}
      </div>
    </div>
  );
}
