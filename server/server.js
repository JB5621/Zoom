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

// Rate limiting — brute-force / spam protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
const roomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Room creation limit reached, please try again later." },
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

function saveUsers() {
  fs.writeFileSync(usersDbPath, JSON.stringify(users, null, 2));
}

function saveSessions() {
  fs.writeFileSync(sessionsDbPath, JSON.stringify(sessions, null, 2));
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
// interpreterTokens: Map<token, { roomId, channelId, used: false }>
const rooms = new Map();
const interpreterTokens = new Map();

// ── REST: Auth ───────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, (req, res) => {
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

app.post("/api/auth/login", authLimiter, (req, res) => {
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

// ── REST: Create room ─────────────────────────────────────────
app.post("/api/rooms", roomLimiter, (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  rooms.set(roomId, {
    id: roomId,
    createdAt: new Date(),
    adminId: null,
    participants: new Map(),   // role=participant
    interpreters: new Map(),   // role=interpreter
    presenterId: null,
    interpretationChannels: [],
  });
  res.json({ roomId });
});

// ── REST: Check room ──────────────────────────────────────────
app.get("/api/rooms/:roomId", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ roomId: room.id, participantCount: room.participants.size });
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
  socket.on("join-room", ({ roomId, userName }) => {
    const id = roomId.toUpperCase();
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

  // ── WebRTC signaling ───────────────────────────────────────
  socket.on("offer", ({ targetId, offer }) =>
    io.to(targetId).emit("offer", { from: socket.id, offer }));
  socket.on("answer", ({ targetId, answer }) =>
    io.to(targetId).emit("answer", { from: socket.id, answer }));
  socket.on("ice-candidate", ({ targetId, candidate }) =>
    io.to(targetId).emit("ice-candidate", { from: socket.id, candidate }));

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

  // ── Disconnect ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    const { roomId, role } = socket.data || {};
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

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`Stop the process using ${PORT} or start this server with a different PORT value.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const scheme = (process.env.HTTPS === "true" || (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH)) ? "https" : "http";
  console.log(`\n🚀 Server on ${scheme}://localhost:${PORT}\n`);
  console.log(`[DATA] users: ${usersDbPath}`);
  console.log(`[DATA] sessions: ${sessionsDbPath}`);
  console.log(`[DATA] usersCount=${Array.isArray(users)?users.length:0} sessionsCount=${Object.keys(sessions||{}).length}`);
});
