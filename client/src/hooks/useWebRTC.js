// ============================================================
// useWebRTC.js — media over an SFU, plus all room socket events.
//
// This used to build one RTCPeerConnection per participant. That mesh
// asked each client to encode and upload its camera once per peer, so
// the fifth person to join cost everyone already in the call another
// upload — and it made joining order matter, because two clients had to
// agree which of them would offer.
//
// Now there is exactly one connection: to the server. You `produce`
// your tracks up it once, and `consume` one stream per remote producer
// back down it. Nothing about the call depends on who joined first, and
// a client with no camera (an interpreter) simply produces no video
// rather than having to negotiate its absence.
//
// The shape this hook returns is unchanged, so Room, InterpreterRoom
// and the recorder still see `peers[socketId].stream` as before.
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import {
  CAMERA_CONSTRAINTS, CAMERA_ENCODINGS, SCREEN_ENCODINGS,
  AUDIO_CODEC_OPTIONS, CAMERA_CODEC_OPTIONS, setContentHints,
} from "./mediaTuning";
import { getRoomPass, verifyRoomPassword } from "../lib/roomAccess";

/** How long to wait on a server acknowledgement before giving up. */
const ACK_TIMEOUT_MS = 15_000;

export function useWebRTC(roomId, userName, interpreterToken = null, initialMedia = null) {
  const socketRef        = useRef(null);
  const localStreamRef   = useRef(null);
  const screenStreamRef  = useRef(null);
  const cameraTrackRef = useRef(null);
  const micTrackRef = useRef(null);
  const backgroundRef = useRef(null);
  const initialRef = useRef(initialMedia);
  const [background, setBackground] = useState('none');

  // ── SFU plumbing ─────────────────────────────────────────────
  const deviceRef        = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef     = useRef({ audio: null, video: null });
  const consumersRef     = useRef(new Map());   // consumerId -> Consumer
  // socketId -> Map<producerId, MediaStreamTrack>. One entry per remote
  // person, rebuilt into a MediaStream whenever their tracks change.
  const peerTracksRef    = useRef(new Map());
  // Producers announced before the receive transport existed. Without
  // this, anyone already speaking when you join is silently skipped.
  const pendingProducers = useRef([]);
  const consumingRef = useRef(new Set());
  const sfuStateRef      = useRef({ starting: false, ready: false });

  const [localStream,     setLocalStream]     = useState(null);
  const [peers,           setPeers]           = useState({});
  const [interpreterIds,  setInterpreterIds]  = useState(new Set());
  const [isMuted,         setIsMuted]         = useState(initialMedia?.muted || false);
  const [isVideoOff,      setIsVideoOff]      = useState(initialMedia?.videoOff || false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [messages,        setMessages]        = useState([]);
  const [error,           setError]           = useState(null);
  const [myId, setMyId] = useState(null);
  const [isConnected,     setIsConnected]     = useState(false);
  const [presenterId,     setPresenterId]     = useState(null);
  const [myRole,          setMyRole]          = useState(interpreterToken ? "interpreter" : "participant");
  const [myChannelInfo,   setMyChannelInfo]   = useState(null);
  const [interpreterError,setInterpreterError]= useState(null);
  const [joinError,       setJoinError]       = useState(null);
  // Set when the host closes the meeting, so the room can say so rather
  // than just going silent as the peers drop off one by one.
  const [roomEnded,       setRoomEnded]       = useState(false);

  // ── Interpretation state (managed here so socket is ready) ───
  const [channels,    setChannels]    = useState([]);
  const [adminId,     setAdminId]     = useState(null);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [adminTokens, setAdminTokens] = useState([]);

  // ── Devices ──────────────────────────────────────────────────
  const [cameras,        setCameras]        = useState([]);
  const [microphones,    setMicrophones]    = useState([]);
  const [speakers,       setSpeakers]       = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [activeMicId,    setActiveMicId]    = useState(null);
  const [activeSpeakerId,setActiveSpeakerId]= useState(initialMedia?.speaker || null);

  const refreshDevices = useCallback(async () => {
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      setCameras(d.filter(x => x.kind === "videoinput"));
      setMicrophones(d.filter(x => x.kind === "audioinput"));
      setSpeakers(d.filter(x => x.kind === "audiooutput"));
    } catch (error) { console.warn(error.message); }
  }, []);

  const updatePeer = useCallback((id, data) =>
    setPeers(p => ({ ...p, [id]: { ...(p[id]||{}), ...data } })), []);

  const removePeer = useCallback((id) =>
    setPeers(p => { const n={...p}; delete n[id]; return n; }), []);

  /**
   * Ask the server something and wait for its acknowledgement.
   *
   * The mesh correlated replies by hand through paired events; an ack
   * ties a response to its request for free. The timeout matters because
   * mediasoup-client's transport callbacks would otherwise wait forever,
   * leaving a call that looks like it is still connecting.
   */
  const request = useCallback((event, payload = {}) => new Promise((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket) return reject(new Error("no socket"));

    const timer = setTimeout(
      () => reject(new Error(`${event} timed out`)), ACK_TIMEOUT_MS);

    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      if (!response) return reject(new Error(`${event} returned nothing`));
      if (response.error) return reject(new Error(`${event}: ${response.error}`));
      resolve(response);
    });
  }), []);

  // ── Remote track bookkeeping ─────────────────────────────────
  // A fresh MediaStream on every change, never a mutated one: the video
  // elements key their srcObject on stream identity, so reusing the
  // object means a track arriving later never reaches the element.

  const rebuildPeerStream = useCallback((socketId) => {
    const tracks = peerTracksRef.current.get(socketId);
    updatePeer(socketId, {
      stream: tracks && tracks.size ? new MediaStream([...tracks.values()]) : null,
    });
  }, [updatePeer]);

  const addPeerTrack = useCallback((socketId, producerId, track) => {
    let tracks = peerTracksRef.current.get(socketId);
    if (!tracks) { tracks = new Map(); peerTracksRef.current.set(socketId, tracks); }
    tracks.set(producerId, track);
    rebuildPeerStream(socketId);
  }, [rebuildPeerStream]);

  const dropPeerTrack = useCallback((socketId, producerId) => {
    const tracks = peerTracksRef.current.get(socketId);
    if (!tracks) return;
    tracks.delete(producerId);
    if (tracks.size === 0) peerTracksRef.current.delete(socketId);
    rebuildPeerStream(socketId);
  }, [rebuildPeerStream]);

  const dropPeerMedia = useCallback((socketId) => {
    peerTracksRef.current.delete(socketId);
    for (const [id, consumer] of consumersRef.current) {
      if (consumer.appData?.socketId === socketId) {
        try { consumer.close(); } catch { /* already gone */ }
        consumersRef.current.delete(id);
      }
    }
  }, []);

  /** Subscribe to one remote producer and attach its track to that peer. */
  const consumeProducer = useCallback(async ({ producerId, socketId }) => {
    const device = deviceRef.current;
    const transport = recvTransportRef.current;

    // Announced before we were ready — remember it and drain later.
    if (!device || !transport) {
      pendingProducers.current.push({ producerId, socketId });
      return;
    }

    if (consumingRef.current.has(producerId)) return;
    consumingRef.current.add(producerId);
    try {
      const params = await request("sfu-consume", {
        transportId: transport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      const consumer = await transport.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
        appData: { socketId: params.socketId, ...(params.appData || {}) },
      });

      consumersRef.current.set(consumer.id, consumer);
      addPeerTrack(params.socketId, params.producerId, consumer.track);

      // The server holds every consumer paused until this point, so the
      // first keyframe is not spent on a page that cannot draw it yet.
      await request("sfu-resume-consumer", { consumerId: consumer.id });
    } catch (err) {
      consumingRef.current.delete(producerId);
      console.error("[sfu] consume failed:", err.message);
    }
  }, [request, addPeerTrack]);

  // ── Transport setup ──────────────────────────────────────────

  const createSendTransport = useCallback(async () => {
    const params = await request("sfu-create-transport", { direction: "send" });
    const transport = deviceRef.current.createSendTransport(params);

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      request("sfu-connect-transport", { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback);
    });

    // Fires the first time each track is sent up this transport.
    transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
      request("sfu-produce", { transportId: transport.id, kind, rtpParameters, appData })
        .then(({ id }) => callback({ id }))
        .catch(errback);
    });

    transport.on("connectionstatechange", (state) => {
      if (state === "failed") {
        console.error("[sfu] send transport failed");
        setError("Lost the connection to the media server.");
      }
    });

    sendTransportRef.current = transport;
  }, [request]);

  const createRecvTransport = useCallback(async () => {
    const params = await request("sfu-create-transport", { direction: "recv" });
    const transport = deviceRef.current.createRecvTransport(params);

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      request("sfu-connect-transport", { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback);
    });

    transport.on("connectionstatechange", (state) => {
      if (state === "failed") {
        console.error("[sfu] recv transport failed");
        setError("Lost the connection to the media server.");
      }
    });

    recvTransportRef.current = transport;
  }, [request]);

  /** Send our own tracks up. An interpreter has no camera and sends audio only. */
  const produceLocalMedia = useCallback(async () => {
    const transport = sendTransportRef.current;
    const stream = localStreamRef.current;
    if (!transport || !stream) return;

    const audioTrack = micTrackRef.current;
    if (audioTrack && !producersRef.current.audio) {
      producersRef.current.audio = await transport.produce({
        track: audioTrack, stopTracks: false,
        codecOptions: AUDIO_CODEC_OPTIONS,
        appData: { source: "mic" },
      });
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && !producersRef.current.video) {
      producersRef.current.video = await transport.produce({
        track: videoTrack, stopTracks: false,
        encodings: screenStreamRef.current ? SCREEN_ENCODINGS : CAMERA_ENCODINGS,
        codecOptions: CAMERA_CODEC_OPTIONS,
        appData: { source: screenStreamRef.current ? "screen" : "camera" },
      });
    }
    const screenAudio = screenStreamRef.current?.getAudioTracks()[0];
    if (screenAudio && !producersRef.current.screenAudio) {
      producersRef.current.screenAudio = await transport.produce({
        track: screenAudio, stopTracks: false, appData: { source: 'screen-audio' },
      });
    }
  }, []);

  /**
   * Bring the whole media session up, once per successful join.
   *
   * Order is not incidental: the device has to know the router's
   * capabilities before it can build a transport, the transports have to
   * exist before anything can be produced or consumed, and only then is
   * it safe to drain producers announced while we were still setting up.
   */
  const startSfu = useCallback(async () => {
    const state = sfuStateRef.current;
    if (state.starting || state.ready) return;
    state.starting = true;

    try {
      const { rtpCapabilities } = await request("sfu-capabilities");

      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;

      await createSendTransport();
      await createRecvTransport();
      if (screenStreamRef.current) await request("share-request");
      await produceLocalMedia();

      // Everyone already sending when we arrived.
      const { producers } = await request("sfu-existing-producers");
      for (const p of producers) await consumeProducer(p);

      const queued = pendingProducers.current;
      pendingProducers.current = [];
      for (const p of queued) await consumeProducer(p);

      state.ready = true;
    } catch (err) {
      console.error("[sfu] setup failed:", err.message);
      setError(`Could not start media: ${err.message}`);
    } finally {
      state.starting = false;
    }
  }, [request, createSendTransport, createRecvTransport, produceLocalMedia, consumeProducer]);

  /**
   * Drop every media object this tab holds.
   *
   * A reconnect gets a new socket id, so the server has already thrown
   * away our transports and producers; keeping the local halves around
   * would mean producing onto a transport the server never heard of.
   */
  const teardownSfu = useCallback(() => {
    for (const consumer of consumersRef.current.values()) {
      try { consumer.close(); } catch { /* already gone */ }
    }
    consumersRef.current.clear();
    consumingRef.current.clear();
    peerTracksRef.current.clear();
    pendingProducers.current = [];

    for (const key of Object.keys(producersRef.current)) {
      try { producersRef.current[key]?.close(); } catch { /* already gone */ }
      producersRef.current[key] = null;
    }

    try { sendTransportRef.current?.close(); } catch { /* already gone */ }
    try { recvTransportRef.current?.close(); } catch { /* already gone */ }
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;
    sfuStateRef.current = { starting: false, ready: false };
  }, []);

  /**
   * Release every device and connection this tab holds.
   *
   * Three things need exactly this: unmounting, leaving deliberately, and
   * the host closing the meeting. Keeping it in one place is what stops
   * those three drifting apart — a camera left running after one of them
   * is a light that stays on for no reason.
   */
  const teardown = useCallback(() => {
    teardownSfu();
    backgroundRef.current?.stop();
    cameraTrackRef.current?.stop();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    socketRef.current?.disconnect();
  }, [teardownSfu]);

  useEffect(() => {
    if (!roomId && !interpreterToken) return;
    let mounted = true;

    async function init() {
      try {
        const constraints = interpreterToken
          ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
          : CAMERA_CONSTRAINTS;

        const settings = initialRef.current;
        const selected = settings ? {
          audio: settings.hasAudio ? { ...CAMERA_CONSTRAINTS.audio, ...(settings.mic ? { deviceId: { exact: settings.mic } } : {}) } : false,
          video: settings.hasVideo ? { ...CAMERA_CONSTRAINTS.video, ...(settings.camera ? { deviceId: { exact: settings.camera } } : {}) } : false,
        } : constraints;
        const stream = selected.audio || selected.video ? await navigator.mediaDevices.getUserMedia(selected) : new MediaStream();
        if (settings) {
          stream.getAudioTracks().forEach(t => { t.enabled = !settings.muted; });
          stream.getVideoTracks().forEach(t => { t.enabled = !settings.videoOff; });
        }
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        // Tell the encoder these are faces and speech, not a slideshow.
        setContentHints(stream);
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        micTrackRef.current = stream.getAudioTracks()[0] || null;
        setLocalStream(stream);
        const vt = stream.getVideoTracks()[0];
        const at = stream.getAudioTracks()[0];
        if (vt) {
          setActiveCameraId(vt.getSettings().deviceId);
        }
        if (at) {
          setActiveMicId(at.getSettings().deviceId);
        }
        await refreshDevices();
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        // Use the vite proxy for socket.io or fall back to direct server URL
        const SERVER_URL = import.meta.env.VITE_SERVER_URL || "/";
        const socket = io(SERVER_URL, {
          auth: { token: localStorage.getItem("oguzmeeting_auth_token") || localStorage.getItem("zoomclone_auth_token") || "" },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5001,
          reconnectionAttempts: 10,
          transports: ['websocket', 'polling'],
          path: "/socket.io",
        });
        socketRef.current = socket;

        socket.on("host-muted", () => {
          const mic = micTrackRef.current;
          if (mic) mic.enabled = false;
          producersRef.current.audio?.pause();
          setIsMuted(true);
        });
        socket.on("chat-history", history => setMessages(history));
        socket.on("connect", () => {
          setError(null);
          setMyId(socket.id);
          setIsConnected(true);
          if (interpreterToken) {
            socket.emit("join-as-interpreter", { token: interpreterToken, userName });
          } else {
            // Re-read on every connect: socket.io reconnects re-run this and
            // the pass may have been obtained since the first attempt.
            socket.emit("join-room", { roomId, userName, pass: getRoomPass(roomId) });
          }
        });

        socket.on("join-pending", () => setJoinError({ code: "pending", message: "Waiting for administrator approval. This page will join automatically when approved." }));
        socket.on("join-rejected", () => {
          setJoinError({ code: "rejected", message: "Your request to join was denied. Contact the administrator." });
          setInterpreterError("Your request to join was denied. Contact the administrator.");
        });
        socket.on("join-approved", () => {
          setJoinError(null);
          if (interpreterToken) socket.emit("join-as-interpreter", { token: interpreterToken, userName });
          else socket.emit("join-room", { roomId, userName, pass: getRoomPass(roomId) });
        });

        socket.on("disconnect", () => {
          setIsConnected(false);
          // The server has dropped our transports along with the socket
          // id, so the local halves now point at nothing.
          teardownSfu();
          setPeers({});
          setInterpreterIds(new Set());
          setPresenterId(null);
        });

        socket.on("connect_error", (err) => {
          console.error(`[socket.connect_error]`, err);
          setError(`Socket connection failed: ${err.message}`);
        });

        socket.on("error", (err) => {
          console.error(`[socket.error]`, err);
          setError(`Socket error: ${err}`);
        });

        socket.on("reconnect_attempt", () => {
        });

        socket.io.on("reconnect_failed", () => {
          console.error(`[socket.reconnect_failed] Failed to reconnect`);
          setError("Server connection lost and could not reconnect");
        });

        // ── Room users ──────────────────────────────────────
        // These carry identity only now. Media arrives separately, when
        // the server announces each producer, so nothing here has to
        // decide who connects to whom.
        socket.on("room-users", users => {
          users.forEach(u => {
            updatePeer(u.socketId, { userName: u.userName, isMuted: u.isMuted, isVideoOff: u.isVideoOff, role: u.role||"participant", stream: null });
          });
          socket.emit('toggle-mute', { isMuted: !micTrackRef.current?.enabled });
          socket.emit('toggle-video', { isVideoOff: !localStreamRef.current?.getVideoTracks()[0]?.enabled });
          startSfu();
        });

        socket.on("user-joined", u => {
          updatePeer(u.socketId, { userName: u.userName, isMuted: u.isMuted, isVideoOff: u.isVideoOff, role: "participant", stream: null });
        });

        socket.on("user-left", ({ socketId }) => {
          dropPeerMedia(socketId);
          removePeer(socketId);
          setPresenterId(p => p === socketId ? null : p);
        });

        // ── Interpreters ─────────────────────────────────────
        socket.on("interpreter-joined", ({ socketId, userName: n, channelId, channelName }) => {
          setInterpreterIds(prev => new Set([...prev, socketId]));
          updatePeer(socketId, { userName: n, role: "interpreter", channelId, channelName, stream: null, isMuted: false });
        });

        // Interpreters already in the room when we joined. They are kept
        // out of `room-users` so they never render as tiles, which also
        // meant a newcomer never learned they existed.
        socket.on("existing-interpreters", list => {
          setInterpreterIds(prev => {
            const n = new Set(prev);
            list.forEach(i => n.add(i.socketId));
            return n;
          });
          list.forEach(i => {
            updatePeer(i.socketId, {
              userName: i.userName, role: "interpreter",
              channelId: i.channelId, channelName: i.channelName,
              stream: null, isMuted: false,
            });
          });
        });

        socket.on("interpreter-left", ({ socketId }) => {
          setInterpreterIds(prev => { const n = new Set(prev); n.delete(socketId); return n; });
          dropPeerMedia(socketId);
          removePeer(socketId);
        });

        socket.on("interpreter-confirmed", ({ channel }) => {
          setMyRole("interpreter");
          setMyChannelInfo(channel);
          startSfu();
        });

        socket.on("join-error", ({ code, message }) => {
          setJoinError({ code: code || "join-failed", message });
        });

        socket.on("interpreter-error", ({ message }) => setInterpreterError(message));
        socket.on("channel-deleted", () => { setInterpreterError("This channel was removed by the host."); teardown(); });

        // ── SFU media ────────────────────────────────────────
        socket.on("sfu-new-producer", ({ producerId, socketId }) => {
          consumeProducer({ producerId, socketId });
        });

        socket.on("sfu-producer-closed", ({ producerId, socketId }) => {
          dropPeerTrack(socketId, producerId);
        });

        socket.on("sfu-consumer-closed", ({ consumerId, producerId, socketId }) => {
          const consumer = consumersRef.current.get(consumerId);
          if (consumer) {
            try { consumer.close(); } catch { /* already gone */ }
            consumersRef.current.delete(consumerId);
          }
          dropPeerTrack(socketId, producerId);
        });

        // ── Media state ──────────────────────────────────────
        socket.on("user-mute-changed",  ({ socketId, isMuted })    => updatePeer(socketId, { isMuted }));
        socket.on("user-video-changed", ({ socketId, isVideoOff }) => updatePeer(socketId, { isVideoOff }));
        socket.on("new-message", msg => setMessages(p => [...p.slice(-199), msg]));

        // ── Presentation ─────────────────────────────────────
        socket.on("presentation-started", ({ socketId }) => {
          setPresenterId(socketId);
          if (socketId !== socket.id) updatePeer(socketId, { isPresenting: true });
        });
        socket.on("presentation-stopped", ({ socketId }) => {
          setPresenterId(null);
          if (socketId !== socket.id) updatePeer(socketId, { isPresenting: false });
        });

        // ── Interpretation ───────────────────────────────────
        socket.on("interpretation-updated", ({ channels: ch, adminId: aid }) => {
          setChannels(ch);
          setAdminId(aid);
          setIsAdmin(aid === socket.id);
        });

        socket.on("channel-created", data => setAdminTokens(p => [...p, data]));

        socket.on("you-are-admin", () => {
          setIsAdmin(true);
          setAdminId(socket.id);
        });

        // The host closed the meeting. Everyone gets this, the host
        // included, so one code path ends the call on every device.
        socket.on("room-ended", () => {
          setRoomEnded(true);
          teardown();
        });

      } catch(err) {
        console.error(`[init] Critical error during initialization:`, err);
        const errorMsg = err.message || "Could not access camera/microphone";
        setError(errorMsg);
      }
    }

    init();
    navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
    return () => {
      mounted = false;
      navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
      teardown();
    };
  }, [roomId, userName, interpreterToken, updatePeer, removePeer, refreshDevices,
      teardown, teardownSfu, startSfu, consumeProducer, dropPeerTrack, dropPeerMedia]);

  // ── Device switching ──────────────────────────────────────
  // replaceTrack swaps what a producer is sending without renegotiating,
  // so nobody else sees anything more than the picture changing.
  const switchCamera = useCallback(async deviceId => {
    if (screenStreamRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } });
      const t = s.getVideoTracks()[0]; t.enabled = !isVideoOff;
      const producer = producersRef.current.video;
      if (producer) await producer.replaceTrack({ track: t });
      else if (sendTransportRef.current) producersRef.current.video = await sendTransportRef.current.produce({ track: t, stopTracks: false, encodings: CAMERA_ENCODINGS, appData: { source: 'camera' } });
      backgroundRef.current?.stop(); backgroundRef.current = null; setBackground('none');
      const old = localStreamRef.current?.getVideoTracks()[0];
      if (old) { old.stop(); localStreamRef.current.removeTrack(old); }
      cameraTrackRef.current?.stop(); cameraTrackRef.current = t;
      localStreamRef.current.addTrack(t);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setActiveCameraId(deviceId);
    } catch (e) { setError(e.message); }
  }, [isVideoOff]);

  const changeBackground = useCallback(async (mode, imageFile) => {
    if (screenStreamRef.current) throw Error('Stop sharing before changing your background.');
    const raw = cameraTrackRef.current;
    if (!raw || raw.readyState === 'ended') throw Error('Turn on a camera first.');
    let effect = null;
    if (mode !== 'none') {
      const { createBackground } = await import('../lib/background');
      effect = await createBackground(raw, mode, imageFile);
    }
    const track = effect?.track || raw;
    // MediaStreamTrack is an imperative browser resource, not React state.
    // eslint-disable-next-line react-hooks/immutability
    track.enabled = !isVideoOff;
    try { await producersRef.current.video?.replaceTrack({ track }); }
    catch (e) { effect?.stop(); throw e; }
    backgroundRef.current?.stop(); backgroundRef.current = effect;
    localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current.removeTrack(t));
    localStreamRef.current.addTrack(track);
    setLocalStream(new MediaStream(localStreamRef.current.getTracks())); setBackground(mode);
  }, [isVideoOff]);

  const switchMicrophone = useCallback(async deviceId => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: true } });
      const t = s.getAudioTracks()[0];
      t.enabled = !isMuted;
      if (producersRef.current.audio) await producersRef.current.audio.replaceTrack({ track: t });
      else if (sendTransportRef.current) producersRef.current.audio = await sendTransportRef.current.produce({ track: t, stopTracks: false, appData: { source: 'mic' } });
      const old = micTrackRef.current;
      if (old) { old.stop(); localStreamRef.current.removeTrack(old); }
      localStreamRef.current.addTrack(t);
      micTrackRef.current = t;
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setActiveMicId(deviceId);
    } catch (error) { console.warn(error.message); }
  }, [isMuted]);

  const switchSpeaker = useCallback(id => {
    setActiveSpeakerId(id);
    // Apply speaker to all video elements
    document.querySelectorAll("video, audio").forEach(video => {
      if (video.setSinkId) {
        video.setSinkId(id).catch(e => console.warn("setSinkId failed:", e));
      }
    });
  }, []);

  /**
   * Muting pauses the producer as well as the track.
   *
   * On a mesh, disabling the track was enough — silence still went out,
   * but only to the people in the call. Through an SFU the server would
   * keep forwarding that silence to everyone, so pausing at the source
   * is what actually stops the bytes.
   */
  const toggleMute = useCallback(() => {
    const t = micTrackRef.current;
    if (!t) return;
    t.enabled = !t.enabled;
    const m = !t.enabled;
    setIsMuted(m);

    const producer = producersRef.current.audio;
    if (producer) {
      if (m) producer.pause(); else producer.resume();
      socketRef.current?.emit("sfu-pause-producer", { producerId: producer.id, paused: m });
    }
    socketRef.current?.emit("toggle-mute", { isMuted: m });
  }, []);

  const toggleVideo = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    const off = !t.enabled;
    if (cameraTrackRef.current && !screenStreamRef.current) cameraTrackRef.current.enabled = !off;
    setIsVideoOff(off);

    const producer = producersRef.current.video;
    if (producer) {
      if (off) producer.pause(); else producer.resume();
      socketRef.current?.emit("sfu-pause-producer", { producerId: producer.id, paused: off });
    }
    socketRef.current?.emit("toggle-video", { isVideoOff: off });
  }, []);

  /**
   * Screen share replaces the camera track on the existing video
   * producer rather than adding a second one. Viewers keep consuming the
   * same producer and simply see different pixels, which is why nobody
   * has to resubscribe when a presentation starts.
   */
  const stopPresentation = useCallback(async () => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach(t => { t.onended = null; t.stop(); localStreamRef.current?.removeTrack(t); });
    screenStreamRef.current = null;
    const audio = producersRef.current.screenAudio;
    if (audio) { socketRef.current?.emit('sfu-close-producer', { producerId: audio.id }); audio.close(); producersRef.current.screenAudio = null; }
    const track = backgroundRef.current?.track || cameraTrackRef.current;
    try {
      if (track?.readyState === 'live') {
        // eslint-disable-next-line react-hooks/immutability
        track.enabled = !isVideoOff;
        await producersRef.current.video?.replaceTrack({ track });
        if (isVideoOff) producersRef.current.video?.pause(); else producersRef.current.video?.resume();
        socketRef.current?.emit('sfu-pause-producer', { producerId: producersRef.current.video?.id, paused: isVideoOff });
      } else if (producersRef.current.video) {
        socketRef.current?.emit('sfu-close-producer', { producerId: producersRef.current.video.id });
        producersRef.current.video.close(); producersRef.current.video = null;
      }
    } catch (e) { console.warn('Restore camera:', e); }
    localStreamRef.current?.getVideoTracks().forEach(t => localStreamRef.current.removeTrack(t));
    if (track?.readyState === 'live') localStreamRef.current?.addTrack(track);
    setLocalStream(new MediaStream(localStreamRef.current?.getTracks() || []));
    setIsSharingScreen(false); setPresenterId(null);
    socketRef.current?.emit('screen-share-stopped');
    socketRef.current?.emit('toggle-video', { isVideoOff });
  }, [isVideoOff]);

  const startPresentation = useCallback(async captureStream => {
    try {
      await request('share-request');
      screenStreamRef.current = captureStream;
      const track = captureStream.getVideoTracks()[0];
      if (producersRef.current.video) {
        await producersRef.current.video.replaceTrack({ track });
        producersRef.current.video.resume();
        await request('sfu-pause-producer', { producerId: producersRef.current.video.id, paused: false });
      } else {
        producersRef.current.video = await sendTransportRef.current.produce({ track, stopTracks: false, encodings: SCREEN_ENCODINGS, appData: { source: 'screen' } });
      }
      const audio = captureStream.getAudioTracks()[0];
      if (audio) {
        producersRef.current.screenAudio = await sendTransportRef.current.produce({ track: audio, stopTracks: false, appData: { source: 'screen-audio' } });
        // Include tab audio in the local recording as well as the remote stream.
        localStreamRef.current.addTrack(audio);
      }
      localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current.removeTrack(t));
      localStreamRef.current.addTrack(track);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setIsSharingScreen(true); setPresenterId(socketRef.current.id);
      socketRef.current.emit('toggle-video', { isVideoOff: false });
      track.onended = () => stopPresentation();
    } catch (e) {
      captureStream.getTracks().forEach(t => t.stop());
      if (screenStreamRef.current === captureStream) await stopPresentation();
      throw e;
    }
  }, [request, stopPresentation]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.on('stop-sharing', stopPresentation);
    return () => socket.off('stop-sharing', stopPresentation);
  }, [isConnected, stopPresentation]);

  // ── Interpretation actions ────────────────────────────────
  const createChannel  = useCallback((src, tgt) => socketRef.current?.emit("create-interpretation-channel", { sourceLang: src, targetLang: tgt }), []);
  const deleteChannel  = useCallback(id => socketRef.current?.emit("delete-interpretation-channel", { channelId: id }), []);

  const sendMessage = useCallback(data => request("chat-send", typeof data === "string" ? { message: data } : data), [request]);
  const leaveRoom = useCallback(() => { teardown(); }, [teardown]);

  /**
   * Close the meeting for everyone. The server checks that this socket is
   * the admin, so a non-host calling it achieves nothing; the local
   * teardown waits for the server's `room-ended` broadcast, which is what
   * confirms the request was accepted.
   */
  const endRoomForAll = useCallback(() => {
    socketRef.current?.emit("end-room");
  }, []);

  const iAmPresenting = presenterId === myId;

  // Called by the password gate: verify, cache the pass, then re-emit the
  // join on the existing socket so nothing has to be torn down.
  const submitRoomPassword = useCallback(async (password) => {
    await verifyRoomPassword(roomId, password);
    setJoinError(null);
    socketRef.current?.emit("join-room", {
      roomId, userName, pass: getRoomPass(roomId),
    });
  }, [roomId, userName]);

  return {
    joinError, submitRoomPassword, roomEnded, request, background, changeBackground,
    localStream, peers, interpreterIds,
    isMuted, isVideoOff, isSharingScreen,
    messages, error, isConnected,
    myRole, myChannelInfo, interpreterError,
    presenterId, iAmPresenting,
    presenterPeer: (presenterId && !iAmPresenting) ? peers[presenterId] : null,
    someoneIsPresenting: !!presenterId,
    // Interpretation
    channels, adminId, isAdmin, adminTokens,
    createChannel, deleteChannel,
    // Devices
    cameras, microphones, speakers,
    activeCameraId, activeMicId, activeSpeakerId,
    switchCamera, switchMicrophone, switchSpeaker,
    // Actions
    toggleMute, toggleVideo,
    startPresentation, stopPresentation,
    sendMessage, leaveRoom, endRoomForAll,
    mySocketId: myId,
    socketRef,
  };
}
