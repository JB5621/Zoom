// ============================================================
// sfu.js — selective forwarding with mediasoup
//
// The full mesh this replaces made every client send one copy of its
// camera to every other client, so a participant's upload cost grew
// with the room: six people meant five encodes and five uploads from
// each laptop, which is why the old code had to keep dialing the
// per-peer bitrate down as people arrived.
//
// Here each client uploads once, to this process, and the server
// forwards. Upload cost is constant no matter how big the call gets.
// The trade is that media now flows through this machine's CPU and
// NIC, which is why workers scale with cores and why the port range
// below has to actually be reachable.
// ============================================================
const mediasoup = require("mediasoup");
const os = require("os");

// ── Configuration ───────────────────────────────────────────
const MIN_PORT = Number(process.env.MEDIASOUP_MIN_PORT || 40000);
const MAX_PORT = Number(process.env.MEDIASOUP_MAX_PORT || 49999);
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0";
const LOG_LEVEL = process.env.MEDIASOUP_LOG_LEVEL || "warn";

/**
 * The address remote browsers are told to send media to.
 *
 * This is the single most common way an SFU deployment fails: on a VPS
 * the auto-detected interface address is the machine's *private* one,
 * so ICE advertises an unroutable candidate, every connection times out
 * and the symptom is a call that signals perfectly and carries no
 * media. Autodetect is fine on a LAN and wrong on a server, so it warns
 * rather than guessing quietly.
 */
function detectAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

const ANNOUNCED_ADDRESS = process.env.MEDIASOUP_ANNOUNCED_IP || detectAddress();

// Codecs the router will handle. VP8 and H264 between them cover every
// current browser; H264 is what lets Safari and older mobile hardware
// use their built-in encoder instead of falling back to software.
const MEDIA_CODECS = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: { "x-google-start-bitrate": 1000 },
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
];

// ── Workers ─────────────────────────────────────────────────
// A worker is a separate C++ process and uses one core, so the pool
// size is what decides how much call this box can actually carry.
const workers = [];
let nextWorkerIndex = 0;

async function initWorkers() {
  const requested = Number(process.env.MEDIASOUP_NUM_WORKERS || 0);
  const count = requested > 0
    ? requested
    : Math.max(1, Math.min(os.cpus().length, 4));

  for (let i = 0; i < count; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: LOG_LEVEL,
      rtcMinPort: MIN_PORT,
      rtcMaxPort: MAX_PORT,
    });

    // A dead worker takes every call on it with it, and nothing this
    // process can do will bring those calls back. Failing loudly beats
    // limping on and handing out routers that forward nothing.
    worker.on("died", () => {
      console.error(`[SFU] worker ${worker.pid} died — exiting`);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }

  console.log(`[SFU] ${count} worker${count === 1 ? "" : "s"} up, ` +
    `ports ${MIN_PORT}-${MAX_PORT}, announcing ${ANNOUNCED_ADDRESS}`);

  if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
    console.warn(
      `[SFU] MEDIASOUP_ANNOUNCED_IP is not set, so clients will be told to ` +
      `send media to ${ANNOUNCED_ADDRESS} (auto-detected).\n` +
      `[SFU] On a server with a public IP this must be set explicitly, or ` +
      `calls will connect and carry no audio or video.`
    );
  }
}

/** Round-robin, so rooms spread across cores instead of stacking on one. */
function pickWorker() {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

// ── Routers ─────────────────────────────────────────────────
// One router per room: it is the thing producers and consumers must
// share to reach each other, and it is also the isolation boundary
// between meetings.

/**
 * The promise, not the router, is cached. Two people joining an empty
 * room at once both reach this before either finishes, and caching the
 * finished object would hand them separate routers — two halves of one
 * meeting that can never see each other.
 */
async function getRouterForRoom(room) {
  if (room.router) return room.router;

  if (!room.routerPromise) {
    const worker = pickWorker();
    room.routerPromise = worker.createRouter({ mediaCodecs: MEDIA_CODECS })
      .then((router) => {
        room.router = router;
        console.log(`[SFU] router for ${room.id} on worker ${worker.pid}`);
        return router;
      })
      .catch((err) => {
        room.routerPromise = null;
        throw err;
      });
  }

  return room.routerPromise;
}

function closeRoomRouter(room) {
  if (!room?.router) return;
  room.router.close();
  room.router = null;
  room.routerPromise = null;
  console.log(`[SFU] router for ${room.id} closed`);
}

// ── Per-client state ────────────────────────────────────────
// socketId -> { roomId, transports, producers, consumers }
const sfuPeers = new Map();

// producerId -> { socketId, roomId, producer }
// Consuming needs the owner of a producer, and the alternative is
// scanning every peer's producer map on each consume.
const producerIndex = new Map();

function peerState(socket) {
  let peer = sfuPeers.get(socket.id);
  if (!peer) {
    peer = {
      roomId: socket.data?.roomId || null,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    sfuPeers.set(socket.id, peer);
  }
  // socket.data.roomId is set by the join handlers, which may land after
  // this peer object was first created.
  if (!peer.roomId && socket.data?.roomId) peer.roomId = socket.data.roomId;
  return peer;
}

/**
 * Drop everything one client holds.
 *
 * Closing a transport cascades to the producers and consumers on it, so
 * this is deliberately transport-first: closing producers individually
 * would fire the same teardown twice.
 */
function cleanupPeer(socketId) {
  const peer = sfuPeers.get(socketId);
  if (!peer) return;

  for (const producerId of peer.producers.keys()) producerIndex.delete(producerId);
  for (const transport of peer.transports.values()) {
    try { transport.close(); } catch { /* already gone */ }
  }

  sfuPeers.delete(socketId);
}

/** Does this room still have anyone holding media? */
function roomHasPeers(roomId) {
  for (const peer of sfuPeers.values()) {
    if (peer.roomId === roomId) return true;
  }
  return false;
}

// ── Signalling ──────────────────────────────────────────────
// Every handler replies through a socket.io acknowledgement rather than
// a matching response event. The old offer/answer pairs had to be
// correlated by hand; an ack ties the reply to its request for free,
// and an `error` field is how a client learns it should stop waiting.

function registerSfuHandlers(io, socket, { getRoom }) {
  const fail = (cb, code) => { if (typeof cb === "function") cb({ error: code }); };

  /** The room this socket is in, or null. */
  function currentRoom() {
    const roomId = socket.data?.roomId;
    return roomId ? getRoom(roomId) : null;
  }

  // What the client's device needs before it can build any transport.
  socket.on("sfu-capabilities", async (_payload, cb) => {
    try {
      const room = currentRoom();
      if (!room) return fail(cb, "not-in-room");
      const router = await getRouterForRoom(room);
      peerState(socket);
      cb?.({ rtpCapabilities: router.rtpCapabilities });
    } catch (err) {
      console.error("[SFU] capabilities:", err.message);
      fail(cb, "capabilities-failed");
    }
  });

  // One transport per direction. They are separate connections because
  // send and receive are negotiated independently.
  socket.on("sfu-create-transport", async ({ direction } = {}, cb) => {
    try {
      const room = currentRoom();
      if (!room) return fail(cb, "not-in-room");
      if (direction !== "send" && direction !== "recv") return fail(cb, "bad-direction");

      const router = await getRouterForRoom(room);
      const transport = await router.createWebRtcTransport({
        listenInfos: [
          { protocol: "udp", ip: LISTEN_IP, announcedAddress: ANNOUNCED_ADDRESS },
          // TCP is the fallback for networks that block UDP outright.
          // It is worse for media, and it is the difference between a
          // bad call and no call on a locked-down corporate network.
          { protocol: "tcp", ip: LISTEN_IP, announcedAddress: ANNOUNCED_ADDRESS },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        enableSctp: false,
        initialAvailableOutgoingBitrate: 1_000_000,
        appData: { socketId: socket.id, direction },
      });

      transport.on("dtlsstatechange", (state) => {
        if (state === "closed" || state === "failed") transport.close();
      });

      const peer = peerState(socket);
      peer.transports.set(transport.id, transport);

      cb?.({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err) {
      console.error("[SFU] create-transport:", err.message);
      fail(cb, "transport-failed");
    }
  });

  socket.on("sfu-connect-transport", async ({ transportId, dtlsParameters } = {}, cb) => {
    try {
      const transport = sfuPeers.get(socket.id)?.transports.get(transportId);
      if (!transport) return fail(cb, "no-transport");
      await transport.connect({ dtlsParameters });
      cb?.({ ok: true });
    } catch (err) {
      console.error("[SFU] connect-transport:", err.message);
      fail(cb, "connect-failed");
    }
  });

  socket.on("sfu-produce", async ({ transportId, kind, rtpParameters, appData } = {}, cb) => {
    try {
      const peer = sfuPeers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      if (!transport) return fail(cb, "no-transport");

      const producer = await transport.produce({
        kind,
        rtpParameters,
        // appData travels to every consumer, which is how the other side
        // tells a camera apart from a screen share.
        appData: { ...(appData || {}), socketId: socket.id },
      });

      peer.producers.set(producer.id, producer);
      producerIndex.set(producer.id, {
        socketId: socket.id, roomId: peer.roomId, producer,
      });

      producer.on("transportclose", () => {
        peer.producers.delete(producer.id);
        producerIndex.delete(producer.id);
      });

      // Everyone else in the room can now ask to consume this.
      socket.to(peer.roomId).emit("sfu-new-producer", {
        producerId: producer.id,
        socketId: socket.id,
        kind: producer.kind,
        appData: producer.appData,
      });

      cb?.({ id: producer.id });
    } catch (err) {
      console.error("[SFU] produce:", err.message);
      fail(cb, "produce-failed");
    }
  });

  // Pausing at the source is the point of muting on an SFU: the bytes
  // stop leaving the client instead of being sent and then ignored.
  socket.on("sfu-pause-producer", async ({ producerId, paused } = {}, cb) => {
    try {
      const producer = sfuPeers.get(socket.id)?.producers.get(producerId);
      if (!producer) return fail(cb, "no-producer");
      if (paused) await producer.pause();
      else await producer.resume();
      cb?.({ ok: true });
    } catch (err) {
      fail(cb, "pause-failed");
    }
  });

  socket.on("sfu-close-producer", ({ producerId } = {}, cb) => {
    const peer = sfuPeers.get(socket.id);
    const producer = peer?.producers.get(producerId);
    if (!producer) return fail(cb, "no-producer");

    producer.close();
    peer.producers.delete(producerId);
    producerIndex.delete(producerId);
    socket.to(peer.roomId).emit("sfu-producer-closed", {
      producerId, socketId: socket.id,
    });
    cb?.({ ok: true });
  });

  // Everything already being sent in this room. A client joining a call
  // in progress has missed every `sfu-new-producer` that came before it.
  socket.on("sfu-existing-producers", (_payload, cb) => {
    const peer = peerState(socket);
    const list = [];
    for (const [producerId, entry] of producerIndex) {
      if (entry.roomId !== peer.roomId) continue;
      if (entry.socketId === socket.id) continue;
      list.push({
        producerId,
        socketId: entry.socketId,
        kind: entry.producer.kind,
        appData: entry.producer.appData,
      });
    }
    cb?.({ producers: list });
  });

  socket.on("sfu-consume", async ({ transportId, producerId, rtpCapabilities } = {}, cb) => {
    try {
      const room = currentRoom();
      if (!room?.router) return fail(cb, "not-in-room");

      const entry = producerIndex.get(producerId);
      if (!entry) return fail(cb, "no-producer");

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return fail(cb, "cannot-consume");
      }

      const peer = sfuPeers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      if (!transport) return fail(cb, "no-transport");

      // Started paused on purpose. Resuming only once the client has the
      // track attached to an element means the first keyframe is not
      // spent on a page that cannot draw it yet.
      const consumer = await transport.consume({
        producerId, rtpCapabilities, paused: true,
      });

      peer.consumers.set(consumer.id, consumer);

      consumer.on("transportclose", () => peer.consumers.delete(consumer.id));
      consumer.on("producerclose", () => {
        peer.consumers.delete(consumer.id);
        socket.emit("sfu-consumer-closed", {
          consumerId: consumer.id, producerId, socketId: entry.socketId,
        });
      });

      cb?.({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        socketId: entry.socketId,
        appData: entry.producer.appData,
      });
    } catch (err) {
      console.error("[SFU] consume:", err.message);
      fail(cb, "consume-failed");
    }
  });

  socket.on("sfu-resume-consumer", async ({ consumerId } = {}, cb) => {
    try {
      const consumer = sfuPeers.get(socket.id)?.consumers.get(consumerId);
      if (!consumer) return fail(cb, "no-consumer");
      await consumer.resume();
      cb?.({ ok: true });
    } catch (err) {
      fail(cb, "resume-failed");
    }
  });
}

/**
 * Called when a socket leaves or the room ends. Closing the router once
 * the last person is gone is what stops an idle meeting holding a slice
 * of a worker for as long as the process lives.
 */
function releasePeer(socketId, room) {
  const peer = sfuPeers.get(socketId);
  const roomId = peer?.roomId || room?.id;
  cleanupPeer(socketId);
  if (roomId && room && !roomHasPeers(roomId)) closeRoomRouter(room);
}

module.exports = {
  initWorkers,
  getRouterForRoom,
  closeRoomRouter,
  registerSfuHandlers,
  cleanupPeer,
  releasePeer,
  ANNOUNCED_ADDRESS,
  MIN_PORT,
  MAX_PORT,
};
