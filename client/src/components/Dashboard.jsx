// ============================================================
// Dashboard.jsx — create a meeting, or join one of three ways
// ============================================================
import React, { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import S, { focusInput, blurInput } from "./pageStyles";
import ThemeToggle from "./ThemeToggle";
import { QrCode, Hash, Link2 } from "./icons";

import {
  createRoom, lookupRoom, verifyRoomPassword, parseRoomRef, isSameOrigin,
} from "../lib/roomAccess";

// The scanner pulls in the QR detector, which is the largest thing on
// this page and useless until someone picks that tab.
const QrScanner = lazy(() => import("./QrScanner"));

const METHODS = [
  { id: "qr", label: "QR code", Icon: QrCode },
  { id: "code", label: "Code", Icon: Hash },
  { id: "link", label: "Link", Icon: Link2 },
];

export default function Dashboard() {
  const { user, submitting, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Join state. `method` picks the route in; all three produce a room
  // reference and then follow the same path from there.
  const [method, setMethod] = useState("code");
  const [roomCode, setRoomCode] = useState("");
  const [linkText, setLinkText] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  // Set once a join has got as far as needing the room password, so the
  // retry knows which room it is for without re-reading the inputs.
  const [pending, setPending] = useState(null);
  // A meeting that exists, but on another host — offered as a link
  // rather than followed automatically.
  const [elsewhere, setElsewhere] = useState(null);

  useEffect(() => {
    if (user?.name) {
      setDisplayName((current) => current.trim() ? current : user.name);
    }
  }, [user]);

  function resetJoinState() {
    setError("");
    setPending(null);
    setJoinPassword("");
    setElsewhere(null);
  }

  async function handleCreate() {
    const meetingName = displayName.trim() || user?.name || "";
    if (!meetingName) return setError("Please enter your name first.");
    const pwd = newPassword.trim();
    if (pwd && pwd.length < 4) return setError("Room password must be at least 4 characters.");
    setLoading(true);
    setError("");
    try {
      const { roomId } = await createRoom(pwd);
      // The password rides along in the URL only for the host, so the invite
      // panel can show it. It is never part of the shared link or the QR.
      const q = new URLSearchParams({ name: meetingName });
      if (pwd) q.set("pwd", pwd);
      navigate(`/room/${roomId}?${q.toString()}`);
    } catch (err) {
      setError(err.message || "Failed to create room. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  /**
   * The single join path. A code typed in, a link pasted and a scanned QR
   * all arrive here as the same `{ code, url }` reference.
   */
  async function join(ref, password) {
    const meetingName = displayName.trim() || user?.name || "";
    if (!meetingName) return setError("Please enter your name first.");

    setError("");
    setElsewhere(null);
    setLoading(true);
    try {
      const room = await lookupRoom(ref.code);
      if (!room.exists) {
        // A link from another deployment parses fine but names a room
        // this server has never heard of. Offer the link instead of
        // reporting a bad code, which would be misleading.
        if (ref.url && !isSameOrigin(ref.url)) {
          setElsewhere(ref.url);
          setError("This server has no meeting with that code. The link points somewhere else.");
        } else {
          setError("Room not found. Check the code and try again.");
        }
        return;
      }

      if (room.hasPassword) {
        // First attempt reveals the field; the next one submits it.
        if (!password) {
          setPending(ref);
          setError("This meeting needs a password.");
          return;
        }
        await verifyRoomPassword(ref.code, password);
      }
      navigate(`/room/${ref.code}?name=${encodeURIComponent(meetingName)}`);
    } catch (err) {
      setError(err.message || "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  function handleJoinCode() {
    const ref = parseRoomRef(roomCode);
    if (!ref) return setError("Please enter a room code.");
    join(ref);
  }

  function handleJoinLink() {
    const ref = parseRoomRef(linkText);
    if (!ref) return setError("That does not look like a meeting link.");
    join(ref);
  }

  function handleScan(text) {
    const ref = parseRoomRef(text);
    if (!ref) {
      setError("That QR code is not a meeting link.");
      return;
    }
    // Show what was read, so a wrong code is obvious rather than silent.
    setRoomCode(ref.code);
    join(ref);
  }

  return (
    <div className="home-page" style={S.page}>
      <ThemeToggle />
      <div style={S.logo}>Oguz Meeting</div>
      <p style={S.tagline}>Welcome back, {user.name}.</p>

      <div style={S.accountBar}>
        <div style={{ minWidth: 0 }}>
          <div style={S.accountText}>Signed in as {user.name}</div>
          <div style={{ ...S.accountSubtext, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
        </div>
        <button style={S.logoutBtn} onClick={logout} disabled={submitting}>
          Log out
        </button>
      </div>

      <div className="home-card" style={S.card}>
        <label style={S.label}>Your Name</label>
        <input
          style={S.nameInput}
          placeholder="e.g. Alex Johnson"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          onFocus={focusInput}
          onBlur={blurInput}
        />

        <label style={S.label}>Meeting password (optional)</label>
        <input
          type="password"
          style={S.nameInput}
          placeholder="Leave blank for no password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          onFocus={focusInput}
          onBlur={blurInput}
        />

        <button
          style={S.btnPrimary}
          onClick={handleCreate}
          disabled={loading}
          onMouseEnter={(e) => { e.target.style.background = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { e.target.style.background = "var(--accent)"; }}
        >
          {loading ? "Creating..." : "New Meeting"}
        </button>

        <div style={S.divider}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>or join existing</span>
          <div style={S.dividerLine} />
        </div>

        <div style={S.joinMethods} role="tablist" aria-label="How to join">
          {METHODS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={method === m.id}
              onClick={() => { setMethod(m.id); resetJoinState(); }}
              style={{ ...S.joinMethod, ...(method === m.id ? S.joinMethodActive : null) }}
            >
              <m.Icon size={15} /> {m.label}
            </button>
          ))}
        </div>

        {method === "qr" && (
          <Suspense fallback={
            <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>Loading the scanner…</p>
          }>
            <QrScanner onResult={handleScan} />
          </Suspense>
        )}

        {method === "code" && (
          <>
            <label style={S.label}>Room Code</label>
            <div className="home-join-row" style={S.joinRow}>
              <input
                style={S.joinInput}
                placeholder="e.g. A3F9B21C"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  if (pending) resetJoinState();
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinCode()}
                onFocus={focusInput}
                onBlur={blurInput}
                maxLength={8}
              />
              <button
                style={S.btnSecondary}
                onClick={handleJoinCode}
                disabled={loading}
                onMouseEnter={(e) => { e.target.style.background = "var(--surface-3)"; }}
                onMouseLeave={(e) => { e.target.style.background = "var(--surface-2)"; }}
              >
                Join
              </button>
            </div>
            <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "10px", marginBottom: 0, lineHeight: 1.5 }}>
              The host can read this out from their invite panel.
            </p>
          </>
        )}

        {method === "link" && (
          <>
            <label style={S.label}>Meeting link</label>
            <div className="home-join-row" style={S.joinRow}>
              <input
                style={{ ...S.joinInput, letterSpacing: "normal" }}
                placeholder="https://…/room/A3F9B21C"
                value={linkText}
                onChange={(e) => {
                  setLinkText(e.target.value);
                  if (pending) resetJoinState();
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinLink()}
                onFocus={focusInput}
                onBlur={blurInput}
              />
              <button
                style={S.btnSecondary}
                onClick={handleJoinLink}
                disabled={loading}
                onMouseEnter={(e) => { e.target.style.background = "var(--surface-3)"; }}
                onMouseLeave={(e) => { e.target.style.background = "var(--surface-2)"; }}
              >
                Join
              </button>
            </div>
            <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "10px", marginBottom: 0, lineHeight: 1.5 }}>
              Paste the whole link. Opening it directly works too — this is
              here for when the link arrived as text you cannot click.
            </p>
          </>
        )}

        {pending && (
          <>
            <label style={{ ...S.label, marginTop: "16px" }}>Meeting password</label>
            <input
              type="password"
              autoFocus
              style={S.nameInput}
              placeholder="Password for this room"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join(pending, joinPassword)}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <button
              style={S.btnSecondary}
              onClick={() => join(pending, joinPassword)}
              disabled={loading}
            >
              {loading ? "Checking…" : `Join ${pending.code}`}
            </button>
          </>
        )}

        {error && <div style={S.error}>{error}</div>}

        {elsewhere && (
          <a
            href={elsewhere}
            style={{
              display: "block", marginTop: "10px", padding: "10px 14px",
              background: "var(--surface-2)", border: "1px solid var(--border-strong)",
              borderRadius: "8px", color: "var(--text-1)", fontWeight: 600,
              fontSize: "0.82rem", textAlign: "center", textDecoration: "none",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            Open {elsewhere}
          </a>
        )}
      </div>

      <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "32px", textAlign: "center" }}>
        Powered by WebRTC · Accounts stored in a local JSON database
      </p>
    </div>
  );
}
