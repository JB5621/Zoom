// ============================================================
// InvitePanel.jsx — the three ways to get someone into a meeting:
// a link, a scannable QR code, and the room code + password.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import { encodeQR, qrToSvgPath } from "../lib/qr";
import { roomLink, fetchLanHosts, isLoopbackOrigin } from "../lib/roomAccess";
import { Copy, Check } from "./icons";

function CopyRow({ label, value, mono = false }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard is blocked without a user gesture or on insecure origins;
      // the value stays selectable on screen either way.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ marginBottom: "clamp(12px, 3vw, 16px)" }}>
      <div style={{
        color: "var(--text-2)", fontSize: "0.72rem", fontWeight: 600,
        letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px",
      }}>{label}</div>
      <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
        <div style={{
          flex: 1, minWidth: 0, background: "var(--surface-2)",
          border: "1px solid var(--border)", borderRadius: "8px",
          padding: "10px 12px", color: "var(--text-1)",
          fontSize: mono ? "0.95rem" : "0.82rem",
          fontFamily: mono ? "monospace" : "inherit",
          letterSpacing: mono ? "0.12em" : "normal",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "flex", alignItems: "center",
        }}>{value}</div>
        <button
          onClick={copy}
          title={`Copy ${label.toLowerCase()}`}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "0 14px", minHeight: "44px", flexShrink: 0,
            background: copied ? "var(--success-soft)" : "var(--surface-3)",
            border: `1px solid ${copied ? "var(--success-border)" : "var(--border)"}`,
            borderRadius: "8px", cursor: "pointer", fontWeight: 600,
            fontSize: "0.8rem", fontFamily: "inherit",
            color: copied ? "var(--success-text)" : "var(--text-1)",
          }}
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { id: "link", label: "Link" },
  { id: "qr", label: "QR code" },
  { id: "code", label: "Code" },
];

export default function InvitePanel({ roomId, password, onClose }) {
  const [tab, setTab] = useState("link");
  const [lanHosts, setLanHosts] = useState([]);
  const [host, setHost] = useState("");

  // On localhost the origin is not reachable from anyone else's device, so
  // ask the server which of its addresses actually is.
  useEffect(() => {
    if (!isLoopbackOrigin()) return;
    let cancelled = false;
    fetchLanHosts().then((hosts) => {
      if (cancelled || hosts.length === 0) return;
      setLanHosts(hosts);
      setHost((current) => current || hosts[0]);
    });
    return () => { cancelled = true; };
  }, []);

  const onLoopback = isLoopbackOrigin();
  const link = roomLink(roomId, host);
  const unreachable = onLoopback && !host;

  // Encoding is pure work over a short string, but it runs eight mask
  // passes, so keep it off every unrelated re-render.
  const qr = useMemo(() => {
    try {
      const { size, modules } = encodeQR(link);
      return qrToSvgPath(modules, size);
    } catch (err) {
      return { error: err.message };
    }
  }, [link]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "var(--scrim)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 500, padding: "clamp(12px, 3vw, 16px)",
      }}
    >
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border)",
        borderRadius: "14px", width: "100%", maxWidth: "min(440px, 92vw)",
        maxHeight: "88vh", overflowY: "auto", boxShadow: "var(--shadow-modal)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px) clamp(10px, 3vw, 14px)",
          borderBottom: "1px solid var(--border)", gap: "12px",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "clamp(0.9rem, 3vw, 1.05rem)", color: "var(--text-1)" }}>
              Invite people
            </div>
            <div style={{ color: "var(--text-2)", fontSize: "0.8rem", marginTop: "2px" }}>
              Share a link, let them scan, or read out the code
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 40, height: 40, flexShrink: 0, borderRadius: "8px",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              color: "var(--text-1)", cursor: "pointer", fontSize: "1rem",
            }}
          >✕</button>
        </div>

        <div style={{ display: "flex", gap: "4px", padding: "12px 24px 0", borderBottom: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px", background: tab === t.id ? "var(--accent-soft)" : "transparent",
                border: "none", borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                color: tab === t.id ? "var(--accent-text)" : "var(--text-2)",
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: "0.85rem",
              }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{ padding: "clamp(16px, 4vw, 22px) clamp(16px, 3vw, 24px)" }}>
          {unreachable && (
            <div style={{
              background: "var(--warn-soft)", border: "1px solid var(--warn-border)",
              color: "var(--warn-text)", borderRadius: "8px", padding: "10px 12px",
              fontSize: "0.78rem", lineHeight: 1.5, marginBottom: "14px",
            }}>
              This link points at <strong>localhost</strong>, which only works on
              this computer. No other network address was found, so a phone will
              not be able to open it.
            </div>
          )}

          {lanHosts.length > 1 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{
                color: "var(--text-2)", fontSize: "0.72rem", fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px",
              }}>Network address</div>
              <select
                value={host}
                onChange={(e) => setHost(e.target.value)}
                style={{
                  width: "100%", background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)", borderRadius: "8px",
                  padding: "10px 12px", color: "var(--text-1)", fontSize: "0.85rem",
                  fontFamily: "inherit", minHeight: "44px", outline: "none",
                }}
              >
                {lanHosts.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
          {tab === "link" && (
            <>
              <CopyRow label="Meeting link" value={link} />
              {password && <CopyRow label="Password" value={password} mono />}
              <p style={{ color: "var(--text-3)", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
                {password
                  ? "Anyone with the link still has to enter the password."
                  : "Anyone with this link can join straight away."}
              </p>
            </>
          )}

          {tab === "qr" && (
            <div style={{ textAlign: "center" }}>
              {qr.error ? (
                <p style={{ color: "var(--danger-text)", fontSize: "0.85rem" }}>{qr.error}</p>
              ) : (
                <>
                  {/* White quiet zone regardless of theme: scanners expect
                      dark-on-light and a dark card would break contrast. */}
                  <svg
                    viewBox={`0 0 ${qr.extent} ${qr.extent}`}
                    role="img"
                    aria-label={`QR code linking to ${link}`}
                    style={{
                      width: "min(300px, 72vw)", height: "auto",
                      background: "#FFFFFF", borderRadius: "10px",
                      padding: "6px", border: "1px solid var(--border)",
                    }}
                  >
                    <path d={qr.path} fill="#000000" shapeRendering="crispEdges" />
                  </svg>
                  <p style={{ color: "var(--text-2)", fontSize: "0.82rem", marginTop: "14px", marginBottom: 0 }}>
                    Point a phone camera at this to join
                  </p>
                  {link.startsWith("https://") && (
                    <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "8px", marginBottom: 0, lineHeight: 1.5 }}>
                      The certificate is self-signed, so the phone will warn once —
                      choose “advanced” and continue. The phone must be on the same
                      Wi-Fi network.
                    </p>
                  )}
                  {password && (
                    <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "6px", marginBottom: 0 }}>
                      They will be asked for the password after scanning
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "code" && (
            <>
              <CopyRow label="Room code" value={roomId} mono />
              {password && <CopyRow label="Password" value={password} mono />}
              <p style={{ color: "var(--text-3)", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
                They can enter this on the dashboard under “or join existing”.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
