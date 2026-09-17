// ============================================================
// Dashboard.jsx — create or join a meeting
// ============================================================
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import S, { focusInput, blurInput } from "./pageStyles";
import ThemeToggle from "./ThemeToggle";

import { createRoom, lookupRoom, verifyRoomPassword } from "../lib/roomAccess";

export default function Dashboard() {
  const { user, submitting, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.name) {
      setDisplayName((current) => current.trim() ? current : user.name);
    }
  }, [user]);

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

  async function handleJoin() {
    const meetingName = displayName.trim() || user?.name || "";
    if (!meetingName) return setError("Please enter your name first.");
    const code = roomCode.trim().toUpperCase();
    if (!code) return setError("Please enter a room code.");
    setError("");
    setLoading(true);
    try {
      const room = await lookupRoom(code);
      if (!room.exists) return setError("Room not found. Check the code and try again.");

      if (room.hasPassword) {
        // First press reveals the field; the second one submits it.
        if (!joinPassword) {
          setNeedsPassword(true);
          return setError("This meeting needs a password.");
        }
        await verifyRoomPassword(code, joinPassword);
      }
      navigate(`/room/${code}?name=${encodeURIComponent(meetingName)}`);
    } catch (err) {
      setError(err.message || "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home-page" style={S.page}>
      <ThemeToggle />
      <div style={S.logo}>ZoomClone</div>
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

        <label style={S.label}>Room Code</label>
        <div className="home-join-row" style={S.joinRow}>
          <input
            style={S.joinInput}
            placeholder="e.g. A3F9B21C"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.toUpperCase());
              if (needsPassword) { setNeedsPassword(false); setJoinPassword(""); }
            }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            onFocus={focusInput}
            onBlur={blurInput}
            maxLength={8}
          />
          <button
            style={S.btnSecondary}
            onClick={handleJoin}
            disabled={loading}
            onMouseEnter={(e) => { e.target.style.background = "var(--surface-3)"; }}
            onMouseLeave={(e) => { e.target.style.background = "var(--surface-2)"; }}
          >
            Join
          </button>
        </div>

        {needsPassword && (
          <>
            <label style={{ ...S.label, marginTop: "12px" }}>Meeting password</label>
            <input
              type="password"
              autoFocus
              style={S.nameInput}
              placeholder="Password for this room"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </>
        )}

        {error && <div style={S.error}>{error}</div>}
      </div>

      <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "32px", textAlign: "center" }}>
        Powered by WebRTC · Accounts stored in a local JSON database
      </p>
    </div>
  );
}
