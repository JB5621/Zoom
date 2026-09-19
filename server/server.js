require("dotenv").config();

const express      = require("express");
const http         = require("http");
const https        = require("https");
const fs           = require("fs");
const crypto       = require("crypto");
const { Server }   = require("socket.io");
const cors         = require("cors");
const rateLimit    = require("express-rate-limit");
const compression  = require("compression");
const { v4: uuidv4 } = require("uuid");
const path         = require("path");
const sfu          = require("./sfu");

const app = express();
app.use(compression());

// CORS — restrict to configured origins in production
const rawOrigins = process.env.ALLOWED_ORIGINS || "*";
const corsOrigin = rawOrigins === "*"
  ? "*"
  : rawOrigins.split(",").map(o => o.trim()).filter(Boolean);
const corsOptions = { origin: corsOrigin, methods: ["GET", "POST"] };
app.use(cors(corsOptions));

app.use(express.json());

// Behind the dev server, /api is proxied, so every request reaches Express
// from 127.0.0.1 and req.ip is the proxy rather than the caller. Without
// this the whole LAN shares a single rate-limit bucket. "loopback" trusts
// X-Forwarded-For only when the immediate peer is local — a LAN client
// cannot forge it, because its own peer address is not loopback.
app.set("trust proxy", "loopback");

// ── Rate limiting ─────────────────────────────────────────────
//
// These exist to slow password guessing and signup spam, not to slow
// people down. Two details decide which of those you actually get:
//
//  - Only *failed* attempts count. Counting successful sign-ins meant an
//    ordinary day of use exhausted the budget and locked people out, and
//    a successful login is evidence of the opposite of an attack.
//  - The login key includes the account. Keyed on address alone, one
//    person mistyping their password spends everyone else's budget too —
//    and with the proxy above unfixed, "everyone else" was the whole LAN.

/** Client address, or the proxy's if it did not forward one. */
const addressOf = (req) => req.ip || req.socket?.remoteAddress || "unknown";

/** Reply with how long the caller actually has to wait. */
function limitReached(req, res, next, options) {
  const remainingMs = req.rateLimit?.resetTime
    ? req.rateLimit.resetTime - Date.now()
    : options.windowMs;
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  res.status(options.statusCode).json({
    error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  });
}

// Guessing one account's password.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    return `${addressOf(req)}|${email}`;
  },
  handler: limitReached,
});

// Working through many accounts from one machine. Set high enough that a
// person never meets it, low enough to stop a script enumerating users.
const loginSweepLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: addressOf,
  handler: limitReached,
});

// Signup spam. Registering is rare, so this stays per address.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: addressOf,
  handler: limitReached,
});
const roomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: addressOf,
  message: { error: "Room creation limit reached, please try again later." },
});

// Joining a protected room is a different act from creating one, and a
// roomful of people arriving at once must not look like abuse. Only wrong
// passwords count, so a full room costs nothing.
const roomPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${addressOf(req)}|${String(req.params?.roomId || "").toUpperCase()}`,
  handler: limitReached,
});

// ── JSON auth store ─────────────────────────────────────────
const dataDir = path.join(__dirname, "data");
const usersDbPath = path.join(dataDir, "users.json");
const sessionsDbPath = path.join(dataDir, "sessions.json");

function ensureJsonFile(filePath, fallback) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJsonFile(filePath, fallback) {
  try {
    ensureJsonFile(filePath, fallback);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

let users = readJsonFile(usersDbPath, []);
let sessions = readJsonFile(sessionsDbPath, {});

// Non-blocking writes — this process also handles WebRTC signaling for
// every active call, so a synchronous disk write here would stall
// offer/answer/ICE relaying for everyone while it completes.
function saveUsers() {
  fs.writeFile(usersDbPath, JSON.stringify(users, null, 2), (err) => {
    if (err) console.error("[DATA] Failed to save users.json:", err.message);
  });
}

function saveSessions() {
  fs.writeFile(sessionsDbPath, JSON.stringify(sessions, null, 2), (err) => {
    if (err) console.error("[DATA] Failed to save sessions.json:", err.message);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
  };
}

function verifyPassword(user, password) {
  const hash = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function createSession(userId) {
  const token = `${uuidv4()}${uuidv4()}`;
  sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
  };
  saveSessions();
  return token;
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization || req.headers["x-auth-token"] || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return String(header).trim();
}

function getUserFromToken(token) {
  const session = sessions[token];
  if (!session) return null;
  return users.find(user => user.id === session.userId) || null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const user = token ? getUserFromToken(token) : null;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.authUser = user;
  req.authToken = token;
  next();
}

// ── Production: Serve static client files ──────────────────
const clientPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientPath));

function createServer() {
  const defaultKey = path.join(__dirname, 'certs', 'localhost-key.pem');
  const defaultCert = path.join(__dirname, 'certs', 'localhost.pem');
  const keyPath = process.env.SSL_KEY_PATH || (fs.existsSync(defaultKey) ? defaultKey : null);
  const certPath = process.env.SSL_CERT_PATH || (fs.existsSync(defaultCert) ? defaultCert : null);
  const useHttps = process.env.HTTPS === 'true' || (keyPath && certPath);

  if (useHttps) {
    if (!keyPath || !certPath) {
      throw new Error('HTTPS is enabled but SSL key/cert paths are missing');
    }
    return https.createServer({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }, app);
  }

  return http.createServer(app);
}

const server = createServer();
const io = new Server(server, { cors: corsOptions });

// rooms: Map<roomId, Room>
// Short-lived proof that someone passed the room-password check. Issued by
// POST /api/rooms/:id/verify and presented on socket join. Time-limited but
// reusable, because socket.io reconnects re-emit join-room and a single-use
// pass would drop people on any brief network blip.
const roomPasses = new Map(); // pass -> { roomId, expiresAt }
const ROOM_PASS_TTL_MS = 15 * 60 * 1000;

function issueRoomPass(roomId) {
  const pass = crypto.randomBytes(24).toString("hex");
  roomPasses.set(pass, { roomId, expiresAt: Date.now() + ROOM_PASS_TTL_MS });
  return pass;
}

function roomPassValid(pass, roomId) {
  const entry = roomPasses.get(pass);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) { roomPasses.delete(pass); return false; }
  return entry.roomId === roomId;
}

// Keep the map from growing without bound on a long-lived server.
setInterval(() => {
  const now = Date.now();
  for (const [pass, entry] of roomPasses) if (entry.expiresAt < now) roomPasses.delete(pass);
}, 5 * 60 * 1000).unref();

// interpreterTokens: Map<token, { roomId, channelId, used: false }>
const rooms = new Map();
const interpreterTokens = new Map();

// ── REST: Auth ───────────────────────────────────────────────
app.post("/api/auth/register", registerLimiter, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  console.log(`[AUTH] Register attempt: ${email}`);

  if (name.length < 2) return res.status(400).json({ error: "Name must be at least 2 characters." });
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (users.some(user => user.email === email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const { passwordSalt, passwordHash } = createPasswordRecord(password);
  const user = {
    id: uuidv4(),
    name,
    email,
    passwordSalt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers();
  console.log(`[AUTH] Registered: ${email} -> id=${user.id}`);

  const token = createSession(user.id);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/login", loginSweepLimiter, loginLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  console.log(`[AUTH] Login attempt: ${email}`);

  const user = users.find(entry => entry.email === email);
  if (!user) return res.status(401).json({ error: "Invalid email or password." });

  let passwordMatches = false;
  try {
    passwordMatches = verifyPassword(user, password);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) return res.status(401).json({ error: "Invalid email or password." });

  const token = createSession(user.id);
  console.log(`[AUTH] Login success: ${email} -> token=${token.slice(0,8)}...`);
  res.json({ token, user: sanitizeUser(user) });
});

// DEV: list users (sanitized) — only when not in production
app.get("/api/auth/_debug/users", (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).end();
  res.json(users.map(u => sanitizeUser(u)));
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.authUser) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  delete sessions[req.authToken];
  saveSessions();
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────
function getRoom(roomId) { return rooms.get(roomId?.toUpperCase()); }

function broadcast(roomId, event, data) {
  io.to(roomId).emit(event, data);
}

function broadcastInterpretation(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  // Only send public info (no tokens)
  const safeChannels = room.interpretationChannels.map(({ id, sourceLang, targetLang, name, interpreterSocketId, interpreterName, active }) => ({
    id, sourceLang, targetLang, name, interpreterSocketId, interpreterName, active,
  }));
  io.to(roomId).emit("interpretation-updated", {
    channels: safeChannels,
    adminId: room.adminId,
  });
}

/**
 * Close a room for everybody in it.
 *
 * This is the one exit that does not promote a replacement admin: the
 * meeting is over rather than being handed on. The room is dropped from
 * the map before the sockets are removed so that an event still in
 * flight cannot recreate it, and so the code stops resolving straight
 * away — `getRoom` returning undefined is what makes every other
 * handler a no-op for this room from here on.
 */
function endRoom(room) {
  const roomId = room.id;
  io.to(roomId).emit("room-ended", { reason: "host-ended" });
  rooms.delete(roomId);

  for (const socketId of [...room.participants.keys(), ...room.interpreters.keys()]) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;
    // Clearing socket.data means the disconnect handler skips its room
    // bookkeeping, which would otherwise announce departures from a room
    // that no longer exists and re-arm the empty-room cleanup timer.
    s.data = {};
    s.leave(roomId);
  }
  for (const socketId of [...room.participants.keys(), ...room.interpreters.keys()]) {
    sfu.cleanupPeer(socketId);
  }
  sfu.closeRoomRouter(room);

  room.participants.clear();
  room.interpreters.clear();

  // Interpreter invite links are scoped to the room, so they die with it.
  for (const [token, entry] of interpreterTokens) {
    if (entry.roomId === roomId) interpreterTokens.delete(token);
  }
  console.log(`[ROOM] ${roomId} ended by host`);
}

// ── REST: Create room ─────────────────────────────────────────
app.post("/api/rooms", roomLimiter, (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const rawPassword = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  if (rawPassword && rawPassword.length < 4) {
    return res.status(400).json({ error: "Room password must be at least 4 characters." });
  }

  // Hashed with the same pbkdf2 as user accounts. The plaintext is never
  // stored, so the host copies it from the invite panel at creation time.
  const passwordSalt = rawPassword ? crypto.randomBytes(16).toString("hex") : null;
  rooms.set(roomId, {
    id: roomId,
    createdAt: new Date(),
    adminId: null,
    participants: new Map(),   // role=participant
    interpreters: new Map(),   // role=interpreter
    presenterId: null,
    interpretationChannels: [],
    passwordSalt,
    passwordHash: rawPassword ? hashPassword(rawPassword, passwordSalt) : null,
  });
  // The creator gets a pass straight away so they are not asked for the
  // password they just chose.
  res.json({
    roomId,
    hasPassword: !!rawPassword,
    pass: rawPassword ? issueRoomPass(roomId) : null,
  });
});

// Constant-time comparison; returns true when the room has no password set.
function roomPasswordOk(room, password) {
  if (!room?.passwordHash) return true;
  if (typeof password !== "string" || !password) return false;
  const attempt = hashPassword(password, room.passwordSalt);
  const a = Buffer.from(attempt, "hex");
  const b = Buffer.from(room.passwordHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── REST: LAN addresses ───────────────────────────────────────
// The invite link and QR are useless off-machine when the host is viewing
// the app on localhost: a phone scanning "https://localhost:5173/..." tries
// to reach itself. The client asks here for an address that is actually
// reachable from another device on the same network.
app.get("/api/network", (req, res) => {
  const os = require("os");
  const hosts = [];
  for (const addrs of Object.values(os.networkInterfaces() || {})) {
    for (const a of addrs || []) {
      // Node <18 reports family as the string "IPv4", newer ones as 4.
      const isV4 = a.family === "IPv4" || a.family === 4;
      if (isV4 && !a.internal) hosts.push(a.address);
    }
  }
  res.json({ hosts });
});

// ── REST: Check room ──────────────────────────────────────────
app.get("/api/rooms/:roomId", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({
    roomId: room.id,
    participantCount: room.participants.size,
    hasPassword: !!room.passwordHash,
  });
});

// Exchange the room password for a short-lived pass that the socket join
// presents. Rate limited because it is a guessable secret.
app.post("/api/rooms/:roomId/verify", roomPasswordLimiter, (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (!roomPasswordOk(room, req.body?.password)) {
    return res.status(401).json({ error: "Incorrect room password." });
  }
  res.json({ ok: true, pass: issueRoomPass(room.id) });
});

// ── REST: Validate interpreter token ─────────────────────────
// Used by the client when an interpreter opens their invite link
app.get("/api/interpreter-token/:token", (req, res) => {
  const entry = interpreterTokens.get(req.params.token);
  if (!entry) return res.status(404).json({ error: "Invalid or expired token" });
  const room = getRoom(entry.roomId);
  const channel = room?.interpretationChannels.find(c => c.id === entry.channelId);
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  res.json({
    roomId: entry.roomId,
    channelId: entry.channelId,
    channelName: channel.name,
    sourceLang: channel.sourceLang,
    targetLang: channel.targetLang,
  });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  // ── JOIN (participant) ─────────────────────────────────────
  socket.on("join-room", ({ roomId, userName, pass }) => {
    const id = roomId.toUpperCase();

    // A protected room must be gated here, not only in the REST check:
    // this handler is reachable directly and would otherwise let anyone
    // with the room code straight in.
    const existing = rooms.get(id);
    if (existing?.passwordHash && !roomPassValid(pass, id)) {
      console.warn(`[JOIN] rejected ${socket.id} -> ${id} (bad or missing room pass)`);
      socket.emit("join-error", { code: "password-required",
        message: "This meeting needs a password." });
      return;
    }

    if (!rooms.has(id)) {
      rooms.set(id, {
        id, createdAt: new Date(), adminId: null,
        participants: new Map(), interpreters: new Map(),
        presenterId: null, interpretationChannels: [],
      });
    }
    const room = rooms.get(id);
    if (!room.adminId) room.adminId = socket.id;

    const user = {
      socketId: socket.id,
      userName: userName || `Guest-${socket.id.slice(0,4)}`,
      roomId: id, isMuted: false, isVideoOff: false,
      role: "participant",
    };
    room.participants.set(socket.id, user);
    socket.join(id);
    socket.data = { roomId: id, userName: user.userName, role: "participant" };

    // Tell new user about existing participants (not interpreters)
    const others = [...room.participants.values()].filter(p => p.socketId !== socket.id);
    socket.emit("room-users", others);
    socket.to(id).emit("user-joined", user);

    // Interpreters are deliberately left out of `room-users` so they never
    // appear as tiles, but that also meant a newcomer never learned they
    // existed. The interpreter only hears about newcomers via
    // `user-joined`, where it takes the answering side — so neither end
    // ever sent an offer and anyone joining after the interpreter simply
    // never connected to them. Name them here and let the newcomer offer.
    const activeInterpreters = [...room.interpreters.values()].map(i => ({
      socketId: i.socketId,
      userName: i.userName,
      channelId: i.channelId,
      channelName: i.channelName,
    }));
    if (activeInterpreters.length) {
      socket.emit("existing-interpreters", activeInterpreters);
    }

    // Send current interpretation state
    broadcastInterpretation(id);
    console.log(`[JOIN] ${user.userName} → ${id} (admin: ${room.adminId})`);
  });

  // ── JOIN as INTERPRETER (via invite link) ──────────────────
  socket.on("join-as-interpreter", ({ token, userName }) => {
    const entry = interpreterTokens.get(token);
    if (!entry) {
      socket.emit("interpreter-error", { message: "Invalid or expired invite link." });
      return;
    }

    const room = getRoom(entry.roomId);
    if (!room) {
      socket.emit("interpreter-error", { message: "Room not found." });
      return;
    }

    const channel = room.interpretationChannels.find(c => c.id === entry.channelId);
    if (!channel) {
      socket.emit("interpreter-error", { message: "Channel no longer exists." });
      return;
    }

    const interpreterName = userName || `Interpreter (${channel.targetLang})`;
    channel.interpreterSocketId = socket.id;
    channel.interpreterName = interpreterName;
    channel.active = true;

    const interpreterUser = {
      socketId: socket.id,
      userName: interpreterName,
      roomId: entry.roomId,
      role: "interpreter",
      channelId: entry.channelId,
      channelName: channel.name,
      sourceLang: channel.sourceLang,
      targetLang: channel.targetLang,
    };
    room.interpreters.set(socket.id, interpreterUser);
    socket.join(entry.roomId);
    socket.data = {
      roomId: entry.roomId,
      userName: interpreterName,
      role: "interpreter",
      channelId: entry.channelId,
    };

    // Tell interpreter about all current participants (so WebRTC connects)
    const participants = [...room.participants.values()];
    socket.emit("room-users", participants);

    // Confirm to interpreter their assignment
    socket.emit("interpreter-confirmed", {
      channel: { id: channel.id, name: channel.name, sourceLang: channel.sourceLang, targetLang: channel.targetLang },
    });

    // Notify participants a new interpreter joined (but don't show in main grid)
    socket.to(entry.roomId).emit("interpreter-joined", {
      socketId: socket.id,
      userName: interpreterName,
      channelId: entry.channelId,
      channelName: channel.name,
    });

    broadcastInterpretation(entry.roomId);
    console.log(`[INTERP] ${interpreterName} joined channel "${channel.name}" in ${entry.roomId}`);
  });

  // ── WebRTC signalling (SFU) ────────────────────────────────
  // Media no longer goes client-to-client, so there are no offers to
  // relay between peers: each client negotiates once with the server and
  // the server forwards. sfu.js owns that exchange.
  sfu.registerSfuHandlers(io, socket, { getRoom });

  // ── Media state ────────────────────────────────────────────
  socket.on("toggle-mute", ({ isMuted }) => {
    const room = getRoom(socket.data?.roomId);
    if (!room) return;
    const user = room.participants.get(socket.id) || room.interpreters.get(socket.id);
    if (user) user.isMuted = isMuted;
    socket.to(socket.data.roomId).emit("user-mute-changed", { socketId: socket.id, isMuted });
  });

  socket.on("toggle-video", ({ isVideoOff }) => {
    const room = getRoom(socket.data?.roomId);
    if (!room) return;
    const user = room.participants.get(socket.id) || room.interpreters.get(socket.id);
    if (user) user.isVideoOff = isVideoOff;
    socket.to(socket.data.roomId).emit("user-video-changed", { socketId: socket.id, isVideoOff });
  });

  // ── Chat ───────────────────────────────────────────────────
  socket.on("send-message", ({ message }) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    io.to(roomId).emit("new-message", {
      id: uuidv4(), from: socket.id,
      userName: socket.data.userName, message,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Presentation ───────────────────────────────────────────
  socket.on("screen-share-started", () => {
    const { roomId } = socket.data;
    const room = getRoom(roomId);
    if (room) room.presenterId = socket.id;
    socket.to(roomId).emit("presentation-started", { socketId: socket.id, userName: socket.data.userName });
  });

  socket.on("screen-share-stopped", () => {
    const { roomId } = socket.data;
    const room = getRoom(roomId);
    if (room) room.presenterId = null;
    socket.to(roomId).emit("presentation-stopped", { socketId: socket.id });
  });

  // ── ADMIN: Create interpretation channel ───────────────────
  socket.on("create-interpretation-channel", ({ sourceLang, targetLang }) => {
    const room = getRoom(socket.data?.roomId);
    // First joiner is the admin
    if (!room.adminId) room.adminId = socket.id;

    const channelId = uuidv4();
    const token = uuidv4();

    const channel = {
      id: channelId,
      sourceLang, targetLang,
      name: `${sourceLang} → ${targetLang}`,
      interpreterSocketId: null,
      interpreterName: null,
      active: false,
      token,   // kept server-side only
    };
    room.interpretationChannels.push(channel);

    // Store token → channel mapping
    interpreterTokens.set(token, { roomId: room.id, channelId });

    // Send token back to admin only (so they can share the link)
    socket.emit("channel-created", {
      channelId,
      channelName: channel.name,
      sourceLang,
      targetLang,
      token,
      inviteUrl: `/interpreter?token=${token}`,
    });

    broadcastInterpretation(room.id);
    console.log(`[INTERP] Channel created: ${channel.name} (token: ${token.slice(0,8)}…)`);
  });

  // ── ADMIN: Delete a channel ────────────────────────────────
  socket.on("delete-interpretation-channel", ({ channelId }) => {
    const room = getRoom(socket.data?.roomId);
    if (!room || room.adminId !== socket.id) return;
    const ch = room.interpretationChannels.find(c => c.id === channelId);
    if (ch) {
      interpreterTokens.delete(ch.token);
      if (ch.interpreterSocketId) {
        io.to(ch.interpreterSocketId).emit("channel-deleted");
      }
    }
    room.interpretationChannels = room.interpretationChannels.filter(c => c.id !== channelId);
    broadcastInterpretation(room.id);
  });

  // ── END MEETING (admin only) ───────────────────────────────
  socket.on("end-room", () => {
    const { roomId } = socket.data || {};
    const room = getRoom(roomId);
    // Silently ignored for non-admins, matching the other admin actions:
    // a client that should not have sent this gets no signal either way.
    if (!room || room.adminId !== socket.id) return;
    endRoom(room);
  });

  // ── Disconnect ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomId, role } = socket.data || {};

    // Media first, and before the early return: a socket that never
    // finished joining can still have built transports, and those hold
    // real ports on a worker until something closes them.
    sfu.releasePeer(socket.id, roomId ? getRoom(roomId) : null);

    if (!roomId) return;

    const room = getRoom(roomId);
    if (room) {
      if (role === "interpreter") {
        room.interpreters.delete(socket.id);
        // Mark channel as inactive
        const ch = room.interpretationChannels.find(c => c.interpreterSocketId === socket.id);
        if (ch) {
          ch.interpreterSocketId = null;
          ch.interpreterName = null;
          ch.active = false;
        }
        io.to(roomId).emit("interpreter-left", { socketId: socket.id });
        broadcastInterpretation(roomId);
      } else {
        room.participants.delete(socket.id);
        if (room.adminId === socket.id) {
          // Promote next participant to admin
          const next = [...room.participants.keys()][0];
          room.adminId = next || null;
          if (next) {
            io.to(next).emit("you-are-admin");
            broadcastInterpretation(roomId);
          }
        }
        io.to(roomId).emit("user-left", { socketId: socket.id });
        if (room.presenterId === socket.id) room.presenterId = null;
      }

      if (room.participants.size === 0 && room.interpreters.size === 0) {
        setTimeout(() => {
          const r = getRoom(roomId);
          if (r && r.participants.size === 0 && r.interpreters.size === 0) {
            rooms.delete(roomId);
            console.log(`[ROOM] ${roomId} deleted`);
          }
        }, 60_000);
      }
    }
    console.log(`[-] ${socket.id}`);
  });
});

// ── SPA fallback: Serve index.html for all non-API routes ────
app.get("*", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"), (err) => {
    if (err) res.status(500).send("Error loading page");
  });
});

const PORT = Number(process.env.PORT || 5000);
const serverIsHttps = server instanceof https.Server;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`Stop the process using ${PORT} or start this server with a different PORT value.`);
    process.exit(1);
  }
  throw err;
});

// The mediasoup workers are separate processes and take a moment to come
// up. Listening first would mean the first person to join races them and
// gets a room with no router, so the socket only opens once media can
// actually be carried.
sfu.initWorkers()
  .then(() => {
    server.listen(PORT, () => {
      const scheme = serverIsHttps ? "https" : "http";
      console.log(`\n🚀 Server on ${scheme}://localhost:${PORT}\n`);
      console.log(`[DATA] users: ${usersDbPath}`);
      console.log(`[DATA] sessions: ${sessionsDbPath}`);
      console.log(`[DATA] usersCount=${Array.isArray(users)?users.length:0} sessionsCount=${Object.keys(sessions||{}).length}`);
      console.log(`[SFU] media on ${sfu.ANNOUNCED_ADDRESS}:${sfu.MIN_PORT}-${sfu.MAX_PORT} (UDP+TCP)`);
    });
  })
  .catch((err) => {
    console.error("[SFU] could not start workers:", err.message);
    process.exit(1);
  });
