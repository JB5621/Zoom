// ============================================================
// Dashboard.jsx — create or join a meeting
// ============================================================
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import S, { focusInput, blurInput } from "./pageStyles";

const API_BASE = (import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export default function Dashboard() {
  const { user, submitting, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
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
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/rooms"), { method: "POST" });
      const { roomId } = await res.json();
      navigate(`/room/${roomId}?name=${encodeURIComponent(meetingName)}`);
    } catch {
      setError("Failed to create room. Is the server running?");
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
      const res = await fetch(apiUrl(`/api/rooms/${code}`));
      if (!res.ok) return setError("Room not found. Check the code and try again.");
      navigate(`/room/${code}?name=${encodeURIComponent(meetingName)}`);
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home-page" style={S.page}>
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

        <button
          style={S.btnPrimary}
          onClick={handleCreate}
          disabled={loading}
          onMouseEnter={(e) => { e.target.style.background = "#0284C7"; }}
          onMouseLeave={(e) => { e.target.style.background = "#0EA5E9"; }}
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
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            onFocus={focusInput}
            onBlur={blurInput}
            maxLength={8}
          />
          <button
            style={S.btnSecondary}
            onClick={handleJoin}
            disabled={loading}
            onMouseEnter={(e) => { e.target.style.background = "#E0F2FE"; }}
            onMouseLeave={(e) => { e.target.style.background = "#FFFFFF"; }}
          >
            Join
          </button>
        </div>

        {error && <div style={S.error}>{error}</div>}
      </div>

      <p style={{ color: "#38BDF8", fontSize: "0.78rem", marginTop: "32px", textAlign: "center" }}>
        Powered by WebRTC · Accounts stored in a local JSON database
      </p>
    </div>
  );
}
