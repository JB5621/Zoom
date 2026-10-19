// ============================================================
// Login.jsx — sign in page
// ============================================================
import React, { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthState";
import S, { focusInput, blurInput } from "./pageStyles";
import { LoadingScreen } from "./LoadingScreen";
import ThemeToggle from "./ThemeToggle";
import { LogIn } from "./icons";

export default function Login() {
  const { user, loading: authLoading, submitting, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const navigate = useNavigate();
  const { state } = useLocation();
  const destination = typeof state?.from === "string" && state.from.startsWith("/") && !state.from.startsWith("//") ? state.from : "/dashboard";

  if (authLoading) return <LoadingScreen />;
  if (user) return <Navigate to={destination} replace />;

  async function handleSubmit() {
    setAuthError("");
    const trimmedEmail = email.trim();

    if (!trimmedEmail) return setAuthError("Please enter your email.");
    if (password.length < 6) return setAuthError("Password must be at least 6 characters.");

    try {
      await login({ email: trimmedEmail, password });
      navigate(destination, { replace: true });
    } catch (err) {
      setAuthError(err.message || "Could not sign you in.");
    }
  }

  return (
    <div className="home-page" style={S.page}>
      <ThemeToggle />
      <div style={S.logo}>Oguz Meeting</div>
      <p style={S.tagline}>Sign in to create or join meetings.</p>

      <div className="home-card" style={S.card}>
        <div style={S.authTabs}>
          <span style={{ ...S.authTab, ...S.authTabActive }}>Sign in</span>
          <Link to="/register" style={S.authTab}>Create account</Link>
        </div>

        <p style={S.authHint}>
          Your account is stored in the server’s JSON database, so the same login works again after restart.
        </p>

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

        <button className="icon-btn" style={S.btnPrimary} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Working..." : <><LogIn size={16} /> Sign in</>}
        </button>

        {authError && <div style={S.error}>{authError}</div>}
      </div>

      <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "32px", textAlign: "center" }}>
        Powered by WebRTC · Accounts stored in a local JSON database
      </p>
    </div>
  );
}
