// ============================================================
// RoomPasswordGate.jsx — shown when someone opens a protected room
// from a link or a QR scan and has not cleared the password yet.
// ============================================================
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RoomPasswordGate({ roomId, onSubmit }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit() {
    if (!password) return setError("Enter the meeting password.");
    setBusy(true);
    setError("");
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message || "Incorrect room password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: "clamp(16px, 5vw, 24px)",
    }}>
      <div style={{
        fontWeight: 800, fontSize: "clamp(1.3rem, 5vw, 1.8rem)",
        letterSpacing: "-0.03em", color: "var(--text-1)", marginBottom: "8px",
      }}>Protected meeting</div>
      <p style={{
        color: "var(--text-2)", fontSize: "0.9rem", marginBottom: "28px", textAlign: "center",
      }}>
        Room <strong style={{ color: "var(--text-1)", letterSpacing: "0.1em" }}>{roomId}</strong> needs a password.
      </p>

      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border)",
        borderRadius: "12px", padding: "clamp(20px, 5vw, 28px)",
        width: "100%", maxWidth: "min(380px, 92vw)",
      }}>
        <label style={{
          color: "var(--text-2)", fontSize: "0.75rem", fontWeight: 600,
          letterSpacing: "0.04em", textTransform: "uppercase",
          display: "block", marginBottom: "6px",
        }}>Meeting password</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && handleSubmit()}
          placeholder="Enter password"
          style={{
            width: "100%", background: "var(--surface-2)",
            border: "1px solid var(--border-strong)", borderRadius: "8px",
            padding: "12px 14px", color: "var(--text-1)", fontSize: "0.95rem",
            outline: "none", fontFamily: "inherit", marginBottom: "14px",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={busy}
          style={{
            width: "100%", padding: "12px", background: "var(--accent)",
            border: "none", borderRadius: "8px", color: "var(--on-accent)",
            fontWeight: 600, fontSize: "0.9rem", cursor: busy ? "default" : "pointer",
            minHeight: "44px", opacity: busy ? 0.7 : 1,
          }}
        >{busy ? "Checking…" : "Join meeting"}</button>

        {error && (
          <div style={{
            color: "var(--danger-text)", fontSize: "0.82rem", marginTop: "14px",
            textAlign: "center", padding: "10px 14px", background: "var(--danger-soft)",
            borderRadius: "8px", border: "1px solid var(--danger-border)",
          }}>{error}</div>
        )}

        <button
          onClick={() => navigate("/dashboard")}
          style={{
            width: "100%", marginTop: "12px", padding: "10px",
            background: "transparent", border: "none", color: "var(--text-2)",
            fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit",
          }}
        >← Back to dashboard</button>
      </div>
    </div>
  );
}
