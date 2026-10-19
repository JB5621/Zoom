// ============================================================
// InterpreterJoin.jsx — Entry page for interpreters
// Opened via invite link: /interpreter?token=xxxx
// Validates the token then redirects to /interpreter/:token
// ============================================================
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthState";
import S, { focusInput, blurInput } from "./pageStyles";
import { LoadingScreen } from "./LoadingScreen";
import ThemeToggle from "./ThemeToggle";
import { Headphones } from "./icons";
import { apiUrl } from "../lib/roomAccess";

export default function InterpreterJoin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { user } = useAuth();

  const [channelInfo, setChannelInfo] = useState(null);
  const [userName, setUserName] = useState(user?.name || "");
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState(token ? "" : "No invite token found in link.");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(apiUrl(`/api/interpreter-token/${encodeURIComponent(token)}`), { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setChannelInfo(data); setLoading(false); })
      .catch(() => { if (!controller.signal.aborted) { setError("This invite link is invalid or has expired."); setLoading(false); } });
    return () => controller.abort();
  }, [token]);

  function handleJoin() {
    if (!userName.trim()) return setError("Please enter your name.");
    navigate(`/interpreter/${token}?name=${encodeURIComponent(userName.trim())}`);
  }

  const badge = {
    display: "inline-flex", alignItems: "center", gap: "8px",
    background: "var(--accent-soft)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "8px 16px", marginBottom: "20px",
  };

  if (loading) return <LoadingScreen label="Validating invite link..." />;

  if (error && !channelInfo) return (
    <div style={S.page}>
      <ThemeToggle />
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={S.logo}>Oguz Meeting</div>
        <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>✕</div>
        <p style={{ color: "var(--text-1)", marginBottom: "8px", fontWeight: 600 }}>Invalid Invite Link</p>
        <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={S.logo}>Oguz Meeting</div>
        <h2 style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: "8px", fontSize: "1.1rem" }}>
          Interpreter Invite
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: "0.85rem", marginBottom: "20px" }}>
          You've been invited to interpret for this meeting
        </p>

        {channelInfo && (
          <div style={badge}>
            <span style={{ fontFamily: "inherit", fontWeight: 700, color: "var(--text-1)", fontSize: "0.9rem" }}>
              {channelInfo.channelName}
            </span>
          </div>
        )}

        <p style={{ color: "var(--text-2)", fontSize: "0.8rem", marginBottom: "20px", textAlign: "left" }}>
          You will hear the entire conference but will <strong style={{ color: "var(--text-1)" }}>not be visible</strong> in the main grid.
          Speak in <strong style={{ color: "var(--text-1)" }}>{channelInfo?.targetLang}</strong> and participants who select your channel will hear you.
        </p>

        <input
          style={S.nameInput}
          placeholder="Your interpreter name"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          onFocus={focusInput}
          onBlur={blurInput}
        />
        <button className="icon-btn" style={S.btnPrimary} onClick={handleJoin}>
          <Headphones size={16} /> Join as Interpreter
        </button>
        {error && <div style={S.error}>{error}</div>}
      </div>
    </div>
  );
}
