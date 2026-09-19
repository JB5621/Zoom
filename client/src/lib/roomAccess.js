// ============================================================
// roomAccess.js — room API helpers and the room-password pass.
//
// The pass proves the holder cleared the password check. It lives in
// sessionStorage rather than the URL so that a shared link or a screenshot
// of the QR never carries it, and so it does not end up in browser history.
// ============================================================

const API_BASE = (import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");
const key = (roomId) => `oguzmeeting_pass_${String(roomId).toUpperCase()}`;
const legacyKey = (roomId) => `zoomclone_pass_${String(roomId).toUpperCase()}`;

export function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export function getRoomPass(roomId) {
  try {
    return sessionStorage.getItem(key(roomId)) || sessionStorage.getItem(legacyKey(roomId)) || "";
  } catch {
    return "";
  }
}

export function setRoomPass(roomId, pass) {
  try {
    if (pass) sessionStorage.setItem(key(roomId), pass);
    else sessionStorage.removeItem(key(roomId));
    sessionStorage.removeItem(legacyKey(roomId));
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

// A room id is a uuid's first eight characters, so hex — but the parser
// stays permissive about length and case and lets the server be the one
// to say a code does not exist.
const ROOM_CODE = /^[0-9A-Z]{4,12}$/;
const ROOM_PATH = /\/room\/([0-9A-Za-z]{4,12})(?![0-9A-Za-z])/;

/**
 * Work out which meeting a piece of text refers to. Accepts a bare room
 * code, a full meeting link, or the payload of a scanned QR — the three
 * join routes all end up here so they behave identically from then on.
 *
 * @returns {{ code: string, url: string|null }|null}
 *          `url` is set only when the input was a link, and is what to
 *          open if the meeting turns out to live on another host.
 */
export function parseRoomRef(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const bare = raw.toUpperCase();
  if (ROOM_CODE.test(bare)) return { code: bare, url: null };

  const match = raw.match(ROOM_PATH);
  if (!match) return null;

  let url = null;
  try {
    url = new URL(raw, window.location.origin).href;
  } catch {
    // A /room/CODE fragment with no parseable origin still gives us the
    // code, which is the part that matters.
  }
  return { code: match[1].toUpperCase(), url };
}

/** True when `url` is served by the same origin as this page. */
export function isSameOrigin(url) {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}
