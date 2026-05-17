// ============================================================
// useWebRTC.js — all socket events including interpretation
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC(roomId, userName, interpreterToken = null) {
  const socketRef        = useRef(null);
  const localStreamRef   = useRef(null);
  const screenStreamRef  = useRef(null);
  const peersRef         = useRef({});

  const [localStream,     setLocalStream]     = useState(null);
  const [peers,           setPeers]           = useState({});
  const [interpreterIds,  setInterpreterIds]  = useState(new Set());
  const [isMuted,         setIsMuted]         = useState(false);
  const [isVideoOff,      setIsVideoOff]      = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [messages,        setMessages]        = useState([]);
  const [error,           setError]           = useState(null);
  const [isConnected,     setIsConnected]     = useState(false);
  const [presenterId,     setPresenterId]     = useState(null);
  const [myRole,          setMyRole]          = useState(interpreterToken ? "interpreter" : "participant");
  const [myChannelInfo,   setMyChannelInfo]   = useState(null);
  const [interpreterError,setInterpreterError]= useState(null);

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
  const [activeSpeakerId,setActiveSpeakerId]= useState(null);

  const refreshDevices = useCallback(async () => {
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      setCameras(d.filter(x => x.kind === "videoinput"));
      setMicrophones(d.filter(x => x.kind === "audioinput"));
      setSpeakers(d.filter(x => x.kind === "audiooutput"));
    } catch(e) {}
  }, []);

  const updatePeer = useCallback((id, data) =>
    setPeers(p => ({ ...p, [id]: { ...(p[id]||{}), ...data } })), []);

  const removePeer = useCallback((id) =>
    setPeers(p => { const n={...p}; delete n[id]; return n; }), []);

  const createPeer = useCallback((targetId, isInitiator) => {
    const pc = new RTCPeerConnection(ICE);
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    const remoteStream = new MediaStream();
    pc.ontrack = e => {
      e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
      updatePeer(targetId, { stream: remoteStream });
    };
    pc.onicecandidate = e => {
      if (e.candidate) socketRef.current?.emit("ice-candidate", { targetId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (["failed","disconnected"].includes(pc.connectionState)) {
        pc.close(); delete peersRef.current[targetId]; removePeer(targetId);
      }
    };
    peersRef.current[targetId] = pc;

    if (isInitiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => socketRef.current?.emit("offer", { targetId, offer: pc.localDescription }))
        .catch(console.error);
    }
    return pc;
  }, [updatePeer, removePeer]);

  useEffect(() => {
    if (!roomId && !interpreterToken) return;
    let mounted = true;

    async function init() {
      try {
        const constraints = interpreterToken
          ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false }
          : { video: { width: 1280, height: 720 }, audio: { echoCancellation: true, noiseSuppression: true } };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        setLocalStream(stream);
        const vt = stream.getVideoTracks()[0];
        const at = stream.getAudioTracks()[0];
        if (vt) setActiveCameraId(vt.getSettings().deviceId);
        if (at) setActiveMicId(at.getSettings().deviceId);
        await refreshDevices();

        // Connect via origin path so LAN devices can reach through Vite proxy
        // The proxy will route /socket.io to the backend
        const socket = io();
        socketRef.current = socket;

        socket.on("connect", () => {
          setIsConnected(true);
          if (interpreterToken) {
            socket.emit("join-as-interpreter", { token: interpreterToken, userName });
          } else {
            socket.emit("join-room", { roomId, userName });
          }
        });
        socket.on("disconnect", () => setIsConnected(false));

        // ── Room users ──────────────────────────────────────
        socket.on("room-users", users => {
          users.forEach(u => {
            updatePeer(u.socketId, { userName: u.userName, isMuted: u.isMuted, isVideoOff: u.isVideoOff, role: u.role||"participant", stream: null });
            createPeer(u.socketId, true);
          });
        });

        socket.on("user-joined", u => {
          updatePeer(u.socketId, { userName: u.userName, isMuted: u.isMuted, isVideoOff: u.isVideoOff, role: "participant", stream: null });
          createPeer(u.socketId, false);
        });

        socket.on("user-left", ({ socketId }) => {
          peersRef.current[socketId]?.close();
          delete peersRef.current[socketId];
          removePeer(socketId);
          setPresenterId(p => p === socketId ? null : p);
        });

        // ── Interpreters ─────────────────────────────────────
        socket.on("interpreter-joined", ({ socketId, userName: n, channelId, channelName }) => {
          setInterpreterIds(prev => new Set([...prev, socketId]));
          updatePeer(socketId, { userName: n, role: "interpreter", channelId, channelName, stream: null, isMuted: false });
          createPeer(socketId, false);
        });

        socket.on("interpreter-left", ({ socketId }) => {
          setInterpreterIds(prev => { const n = new Set(prev); n.delete(socketId); return n; });
          peersRef.current[socketId]?.close();
          delete peersRef.current[socketId];
          removePeer(socketId);
        });

        socket.on("interpreter-confirmed", ({ channel }) => {
          setMyRole("interpreter");
          setMyChannelInfo(channel);
        });

        socket.on("interpreter-error", ({ message }) => setInterpreterError(message));
        socket.on("channel-deleted", () => setInterpreterError("This channel was removed by the host."));

        // ── WebRTC ───────────────────────────────────────────
        socket.on("offer", async ({ from, offer }) => {
          let pc = peersRef.current[from];
          if (!pc) pc = createPeer(from, false);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          socket.emit("answer", { targetId: from, answer: pc.localDescription });
        });

        socket.on("answer", async ({ from, answer }) => {
          const pc = peersRef.current[from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on("ice-candidate", async ({ from, candidate }) => {
          const pc = peersRef.current[from];
          if (pc) { try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){} }
        });

        // ── Media state ──────────────────────────────────────
        socket.on("user-mute-changed",  ({ socketId, isMuted })    => updatePeer(socketId, { isMuted }));
        socket.on("user-video-changed", ({ socketId, isVideoOff }) => updatePeer(socketId, { isVideoOff }));
        socket.on("new-message", msg => setMessages(p => [...p, msg]));

        // ── Presentation ─────────────────────────────────────
        socket.on("presentation-started", ({ socketId }) => {
          setPresenterId(socketId); updatePeer(socketId, { isPresenting: true });
        });
        socket.on("presentation-stopped", ({ socketId }) => {
          setPresenterId(null); updatePeer(socketId, { isPresenting: false });
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

      } catch(err) {
        console.error(err);
        setError(err.message || "Could not access camera/microphone");
      }
    }

    init();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
    };
  }, [roomId, userName, interpreterToken, createPeer, updatePeer, removePeer, refreshDevices]);

  // ── Device switching ──────────────────────────────────────
  const switchCamera = useCallback(async deviceId => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } });
      const t = s.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(t);
      });
      const old = localStreamRef.current?.getVideoTracks()[0];
      if (old) { old.stop(); localStreamRef.current.removeTrack(old); }
      localStreamRef.current.addTrack(t);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setActiveCameraId(deviceId);
    } catch(e) {}
  }, []);

  const switchMicrophone = useCallback(async deviceId => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: true } });
      const t = s.getAudioTracks()[0];
      t.enabled = !isMuted;
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "audio");
        if (sender) sender.replaceTrack(t);
      });
      const old = localStreamRef.current?.getAudioTracks()[0];
      if (old) { old.stop(); localStreamRef.current.removeTrack(old); }
      localStreamRef.current.addTrack(t);
      setActiveMicId(deviceId);
    } catch(e) {}
  }, [isMuted]);

  const switchSpeaker = useCallback(id => setActiveSpeakerId(id), []);

  const toggleMute = useCallback(() => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    const m = !t.enabled;
    setIsMuted(m);
    socketRef.current?.emit("toggle-mute", { isMuted: m });
  }, []);

  const toggleVideo = useCallback(() => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    const off = !t.enabled;
    setIsVideoOff(off);
    socketRef.current?.emit("toggle-video", { isVideoOff: off });
  }, []);

  const startPresentation = useCallback(async captureStream => {
    screenStreamRef.current = captureStream;
    const st = captureStream.getVideoTracks()[0];
    Object.values(peersRef.current).forEach(pc => {
      const s = pc.getSenders().find(s => s.track?.kind === "video");
      if (s) s.replaceTrack(st);
    });
    const lv = localStreamRef.current?.getVideoTracks()[0];
    if (lv) localStreamRef.current.removeTrack(lv);
    localStreamRef.current.addTrack(st);
    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    setIsSharingScreen(true);
    socketRef.current?.emit("screen-share-started");
    st.onended = () => stopPresentation();
  }, []);

  const stopPresentation = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      const t = s.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(t);
      });
      const old = localStreamRef.current?.getVideoTracks()[0];
      if (old) localStreamRef.current.removeTrack(old);
      localStreamRef.current.addTrack(t);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch(e) {}
    setIsSharingScreen(false);
    socketRef.current?.emit("screen-share-stopped");
  }, []);

  // ── Interpretation actions ────────────────────────────────
  const createChannel  = useCallback((src, tgt) => socketRef.current?.emit("create-interpretation-channel", { sourceLang: src, targetLang: tgt }), []);
  const deleteChannel  = useCallback(id => socketRef.current?.emit("delete-interpretation-channel", { channelId: id }), []);

  const sendMessage = useCallback(msg => socketRef.current?.emit("send-message", { message: msg }), []);
  const leaveRoom   = useCallback(() => {
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    socketRef.current?.disconnect();
  }, []);

  const myId = socketRef.current?.id;
  const iAmPresenting = presenterId === myId;

  return {
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
    sendMessage, leaveRoom,
    mySocketId: myId,
    socketRef,
  };
}
