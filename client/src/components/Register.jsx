// ============================================================
// Register.jsx — create account page
// ============================================================
import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import S, { LoadingScreen, focusInput, blurInput } from "./pageStyles";

export default function Register() {
  const { user, loading: authLoading, submitting, register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const navigate = useNavigate();

  if (authLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit() {
    setAuthError("");
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) return setAuthError("Please enter your name.");
    if (!trimmedEmail) return setAuthError("Please enter your email.");
    if (password.length < 6) return setAuthError("Password must be at least 6 characters.");

    try {
      await register({ name: trimmedName, email: trimmedEmail, password });
      navigate("/dashboard");
    } catch (err) {
      setAuthError(err.message || "Could not create your account.");
    }
  }

  return (
    <div className="home-page" style={S.page}>
      <div style={S.logo}>ZoomClone</div>
      <p style={S.tagline}>Create an account to start meeting.</p>

      <div className="home-card" style={S.card}>
        <div style={S.authTabs}>
          <Link to="/login" style={S.authTab}>Sign in</Link>
          <span style={{ ...S.authTab, ...S.authTabActive }}>Create account</span>
        </div>

        <p style={S.authHint}>
          Your account is stored in the server’s JSON database, so the same login works again after restart.
        </p>

        <label style={S.label}>Your Name</label>
        <input
          style={S.nameInput}
          placeholder="e.g. Alex Johnson"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onFocus={focusInput}
          onBlur={blurInput}
        />

        <label style={S.label}>Email</label>
        <input
          style={S.nameInput}
          placeholder="e.g. alex@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={focusInput}
          onBlur={blurInput}
        />

        <label style={S.label}>Password</label>
        <input
          type="password"
          style={S.nameInput}
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          onFocus={focusInput}
          onBlur={blurInput}
        />

        <button style={S.btnPrimary} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Working..." : "Create account"}
        </button>

        {authError && <div style={S.error}>{authError}</div>}
      </div>

      <p style={{ color: "#38BDF8", fontSize: "0.78rem", marginTop: "32px", textAlign: "center" }}>
        Powered by WebRTC · Accounts stored in a local JSON database
      </p>
    </div>
  );
}
