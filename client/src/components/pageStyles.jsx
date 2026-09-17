// ============================================================
// pageStyles.jsx — shared styles for Login / Register / Dashboard /
// InterpreterJoin. Colours come from the tokens in index.css; nothing
// here hardcodes a hex, so retheming happens in one place.
// ============================================================
import React from "react";

const S = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: "clamp(16px, 5vw, 24px)",
  },
  logo: {
    fontWeight: 800,
    fontSize: "clamp(1.5rem, 6vw, 2.25rem)",
    letterSpacing: "-0.03em",
    color: "var(--text-1)",
    marginBottom: "clamp(6px, 2vw, 10px)",
  },
  tagline: {
    color: "var(--text-2)",
    fontSize: "clamp(0.9rem, 4vw, 1rem)",
    fontWeight: 400,
    marginBottom: "clamp(28px, 6vw, 40px)",
    textAlign: "center",
    maxWidth: "90vw",
  },
  card: {
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "clamp(24px, 6vw, 40px)",
    width: "100%",
    maxWidth: "min(420px, 90vw)",
  },
  authTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "4px",
    marginBottom: "24px",
    background: "var(--bg)",
    padding: "4px",
    borderRadius: "8px",
  },
  authTab: {
    border: "none",
    borderRadius: "6px",
    padding: "10px 14px",
    background: "transparent",
    color: "var(--text-2)",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
    display: "block",
  },
  authTabActive: {
    background: "var(--surface-2)",
    color: "var(--text-1)",
    boxShadow: "var(--shadow-sm)",
  },
  authHint: {
    color: "var(--text-2)",
    fontSize: "0.85rem",
    lineHeight: 1.5,
    marginBottom: "20px",
  },
  nameInput: {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--border-strong)",
    borderRadius: "8px",
    padding: "clamp(10px, 3vw, 12px) clamp(12px, 3vw, 14px)",
    color: "var(--text-1)",
    fontSize: "clamp(0.875rem, 3vw, 0.95rem)",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    marginBottom: "clamp(12px, 3vw, 16px)",
    fontFamily: "inherit",
  },
  nameInputFocus: {
    borderColor: "var(--accent)",
    boxShadow: "var(--ring)",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "clamp(16px, 4vw, 24px) 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "var(--border)",
  },
  dividerText: {
    color: "var(--text-3)",
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontWeight: 600,
  },
  btnPrimary: {
    width: "100%",
    padding: "clamp(11px, 3vw, 12px)",
    background: "var(--accent)",
    border: "none",
    borderRadius: "8px",
    color: "var(--on-accent)",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    marginBottom: "10px",
    minHeight: "44px",
  },
  joinRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  joinInput: {
    flex: 1,
    minWidth: "clamp(120px, 100%, 200px)",
    background: "var(--surface-2)",
    border: "1px solid var(--border-strong)",
    borderRadius: "8px",
    padding: "clamp(10px, 3vw, 12px) clamp(12px, 3vw, 14px)",
    color: "var(--text-1)",
    fontSize: "clamp(0.875rem, 3vw, 0.95rem)",
    outline: "none",
    fontFamily: "inherit",
    letterSpacing: "0.06em",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  btnSecondary: {
    padding: "clamp(10px, 3vw, 12px) clamp(14px, 3vw, 18px)",
    background: "var(--surface-2)",
    border: "1px solid var(--border-strong)",
    borderRadius: "8px",
    color: "var(--text-1)",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
    minHeight: "44px",
    minWidth: "44px",
  },
  label: {
    color: "var(--text-2)",
    fontSize: "0.75rem",
    marginBottom: "6px",
    display: "block",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  error: {
    color: "var(--danger-text)",
    fontSize: "0.82rem",
    marginTop: "14px",
    textAlign: "center",
    padding: "10px 14px",
    background: "var(--danger-soft)",
    borderRadius: "8px",
    border: "1px solid var(--danger-border)",
  },
  accountBar: {
    width: "100%",
    maxWidth: "min(420px, 90vw)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "16px",
    padding: "12px 16px",
    borderRadius: "10px",
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
  },
  accountText: {
    color: "var(--text-1)",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  accountSubtext: {
    color: "var(--text-2)",
    fontSize: "0.78rem",
    marginTop: "2px",
  },
  logoutBtn: {
    border: "1px solid var(--border-strong)",
    background: "var(--surface-2)",
    color: "var(--text-1)",
    borderRadius: "8px",
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
};

export default S;

export function focusInput(e) {
  Object.assign(e.target.style, S.nameInputFocus);
}

export function blurInput(e) {
  e.target.style.borderColor = "var(--border-strong)";
  e.target.style.boxShadow = "none";
}

export function LoadingScreen({ label = "Loading your session..." }) {
  return (
    <div style={S.page}>
      <div style={S.logo}>ZoomClone</div>
      <p style={S.tagline}>{label}</p>
    </div>
  );
}
