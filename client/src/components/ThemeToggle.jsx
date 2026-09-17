// ============================================================
// ThemeToggle.jsx — light/dark switch.
// `inline` places it inside an existing header row; without it the
// button floats in the top-right of a page that has no header.
// ============================================================
import React from "react";
import { useTheme } from "../hooks/useTheme";

function Sun({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function Moon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export default function ThemeToggle({ inline = false }) {
  const { resolved, toggle } = useTheme();
  const goingTo = resolved === "light" ? "dark" : "light";

  return (
    <button
      onClick={toggle}
      title={`Switch to ${goingTo} theme`}
      aria-label={`Switch to ${goingTo} theme`}
      style={{
        ...(inline ? {} : { position: "fixed", top: "clamp(12px, 3vw, 20px)", right: "clamp(12px, 3vw, 20px)", zIndex: 50 }),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "clamp(36px, 8vw, 40px)",
        height: "clamp(36px, 8vw, 40px)",
        borderRadius: "8px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-2)",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
    >
      {resolved === "light" ? <Moon /> : <Sun />}
    </button>
  );
}
