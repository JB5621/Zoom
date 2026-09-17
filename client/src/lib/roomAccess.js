// ============================================================
// roomAccess.js — room API helpers and the room-password pass.
//
// The pass proves the holder cleared the password check. It lives in
// sessionStorage rather than the URL so that a shared link or a screenshot
// of the QR never carries it, and so it does not end up in browser history.
// ============================================================

const API_BASE = (import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");
const key = (roomId) => `zoomclone_pass_${String(roomId).toUpperCase()}`;

export function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export function getRoomPass(roomId) {
  try {
    return sessionStorage.getItem(key(roomId)) || "";
  } catch {
    return "";
  }
}

export function setRoomPass(roomId, pass) {
  try {
    if (pass) sessionStorage.setItem(key(roomId), pass);
    else sessionStorage.removeItem(key(roomId));
  } catch {
    // A pass we cannot cache just means one extra prompt, not a failure.
  }
}

/** @returns {{ exists: boolean, hasPassword: boolean, participantCount: number }} */
export async function lookupRoom(roomId) {
  const res = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(roomId)}`));
  if (!res.ok) return { exists: false, hasPassword: false, participantCount: 0 };
  const data = await res.json();
  return {
    exists: true,
    hasPassword: !!data.hasPassword,
    participantCount: data.participantCount ?? 0,
  };
}

/** Exchange the room password for a pass. Throws with the server's message. */
export async function verifyRoomPassword(roomId, password) {
  const res = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(roomId)}/verify`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not verify the room password.");
  setRoomPass(roomId, data.pass);
  return data.pass;
}

export async function createRoom(password) {
  const res = await fetch(apiUrl("/api/rooms"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(password ? { password } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create the meeting.");
  if (data.pass) setRoomPass(data.roomId, data.pass);
  return data;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1", ""]);

/** True when the page is being viewed on this machine's own loopback. */
export function isLoopbackOrigin() {
  return LOOPBACK.has(window.location.hostname);
}

/**
 * Addresses of this machine that another device on the same network can
 * actually reach. Only needed while the host is on localhost.
 */
export async function fetchLanHosts() {
  try {
    const res = await fetch(apiUrl("/api/network"));
    if (!res.ok) return [];
    const { hosts } = await res.json();
    return Array.isArray(hosts) ? hosts : [];
  } catch {
    return [];
  }
}

/**
 * The URL someone else opens to join — what the link and the QR both carry.
 * `host` overrides the hostname while keeping this page's protocol and port,
 * so a QR scanned on a phone points at the machine running the meeting
 * rather than at the phone itself.
 */
export function roomLink(roomId, host) {
  const { protocol, port, hostname } = window.location;
  const h = host || hostname;
  const authority = port ? `${h}:${port}` : h;
  return `${protocol}//${authority}/room/${String(roomId).toUpperCase()}`;
}
