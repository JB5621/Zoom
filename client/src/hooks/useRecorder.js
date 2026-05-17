// ============================================================
// useRecorder.js — Composite multi-participant recorder
//
// How it works:
//   1. Creates a hidden off-screen <canvas> (1280×720)
//   2. Every frame (30fps via requestAnimationFrame), draws ALL
//      participant video streams onto the canvas in a grid —
//      exactly like what you see on screen
//   3. Mixes ALL audio streams (local mic + every remote peer)
//      via AudioContext into one track
//   4. canvas.captureStream(30) + mixed audio → MediaRecorder
//   5. On stop → auto-downloads a .webm file
// ============================================================
import { useRef, useState, useCallback, useEffect } from "react";

const CANVAS_W = 1280;
const CANVAS_H = 720;
const FPS = 30;
const LABEL_HEIGHT = 36;
const GAP = 8;

// ── Grid math: given N tiles, how many columns? ───────────────
function gridCols(n) {
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  if (n <= 9) return 3;
  return 4;
}

// ── Calculate tile rects for N items in cols×rows grid ────────
function buildGrid(n) {
  if (n === 0) return [];
  const cols = gridCols(n);
  const rows = Math.ceil(n / cols);
  const tileW = Math.floor((CANVAS_W - GAP * (cols + 1)) / cols);
  const tileH = Math.floor((CANVAS_H - GAP * (rows + 1)) / rows);
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center the last row if it's not full
    const lastRowItems = n % cols || cols;
    const isLastRow = row === rows - 1 && n % cols !== 0;
    const offsetX = isLastRow
      ? Math.floor((CANVAS_W - lastRowItems * (tileW + GAP) + GAP) / 2)
      : GAP;
    tiles.push({
      x: offsetX + col * (tileW + GAP),
      y: GAP + row * (tileH + GAP),
      w: tileW,
      h: tileH,
    });
  }
  return tiles;
}

// ── Draw one video frame into a canvas tile ───────────────────
function drawTile(ctx, videoEl, rect, label, isLocal) {
  const { x, y, w, h } = rect;
  const videoH = h - LABEL_HEIGHT;

  // Background
  ctx.fillStyle = "#111118";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();

  // Clip to rounded rect for video
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, videoH, [12, 12, 0, 0]);
  ctx.clip();

  if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    // cover: maintain aspect ratio
    const scale = Math.max(w / vw, videoH / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const sx = x + (w - sw) / 2;
    const sy = y + (videoH - sh) / 2;

    if (isLocal) {
      // Mirror local video
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, sx - x, sy - y, sw, sh);
    } else {
      ctx.drawImage(videoEl, sx, sy, sw, sh);
    }
  } else {
    // Avatar fallback
    const initials = (label || "?")
      .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const cx = x + w / 2;
    const cy = y + videoH / 2;
    const r = Math.min(w, videoH) * 0.22;
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, "#0080ff");
    grad.addColorStop(1, "#4af0c8");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 0.8}px Syne, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, cx, cy);
  }
  ctx.restore();

  // Label bar
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.beginPath();
  ctx.roundRect(x, y + videoH, w, LABEL_HEIGHT, [0, 0, 12, 12]);
  ctx.fill();
  ctx.fillStyle = "#e8e8f0";
  ctx.font = "500 14px DM Sans, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    (label || "Unknown") + (isLocal ? " (You)" : ""),
    x + 12, y + videoH + LABEL_HEIGHT / 2,
    w - 24
  );
}

export function useRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const sourceNodesRef = useRef([]);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const videoElsRef = useRef([]); // [{ videoEl, label, isLocal }]

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const isPausedRef = useRef(false);

  function startTimer() {
    startTimeRef.current = Date.now() - pausedAtRef.current * 1000;
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  }
  function stopTimer() { clearInterval(timerRef.current); }
  useEffect(() => () => { stopTimer(); cancelAnimationFrame(rafRef.current); }, []);

  function formatDuration(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  // ── Create a hidden <video> element for a stream ──────────────
  function makeVideoEl(stream) {
    const el = document.createElement("video");
    el.srcObject = stream;
    el.autoplay = true;
    el.muted = true;
    el.playsInline = true;
    el.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px";
    document.body.appendChild(el);
    el.play().catch(() => {});
    return el;
  }

  // ── Mix all audio streams into one track ──────────────────────
  function buildMixedAudio(streams) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    const sources = [];
    streams.forEach((s) => {
      if (!s || s.getAudioTracks().length === 0) return;
      try {
        const src = audioCtx.createMediaStreamSource(s);
        src.connect(dest);
        sources.push(src);
      } catch (e) { console.warn("Audio mix error:", e); }
    });
    audioCtxRef.current = audioCtx;
    sourceNodesRef.current = sources;
    return dest.stream.getAudioTracks()[0];
  }

  // ── Canvas render loop ────────────────────────────────────────
  function startRenderLoop(canvas, entries) {
    const ctx = canvas.getContext("2d");

    function frame() {
      if (!isPausedRef.current) {
        // Dark background
        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const tiles = buildGrid(entries.length);
        entries.forEach((entry, i) => {
          drawTile(ctx, entry.videoEl, tiles[i], entry.label, entry.isLocal);
        });

        // Watermark
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "bold 15px Syne, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("ZoomClone", CANVAS_W - 16, CANVAS_H - 12);
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }

  // ── START recording ───────────────────────────────────────────
  // participants: [{ stream, label, isLocal }]
  const startRecording = useCallback(async (participants = []) => {
    if (isRecording || participants.length === 0) return;

    chunksRef.current = [];
    pausedAtRef.current = 0;
    isPausedRef.current = false;
    setDuration(0);

    // 1. Create hidden video elements for each participant
    const entries = participants
      .filter((p) => p.stream)
      .map((p) => ({
        videoEl: makeVideoEl(p.stream),
        label: p.label,
        isLocal: p.isLocal,
        stream: p.stream,
      }));
    videoElsRef.current = entries;

    // 2. Create off-screen canvas
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvasRef.current = canvas;

    // 3. Start render loop
    startRenderLoop(canvas, entries);

    // 4. Mix all audio
    const allStreams = entries.map((e) => e.stream);
    const audioTrack = buildMixedAudio(allStreams);

    // 5. Capture canvas + audio → composite stream
    const canvasStream = canvas.captureStream(FPS);
    const videoTrack = canvasStream.getVideoTracks()[0];
    const tracks = [videoTrack, audioTrack].filter(Boolean);
    const compositeStream = new MediaStream(tracks);

    // 6. Pick best codec
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";

    try {
      const mr = new MediaRecorder(compositeStream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 3_000_000,  // 3 Mbps for multi-tile quality
        audioBitsPerSecond: 128_000,
      });

      mr.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        // Stop render loop
        cancelAnimationFrame(rafRef.current);

        // Remove hidden video elements
        videoElsRef.current.forEach(({ videoEl }) => {
          videoEl.srcObject = null;
          document.body.removeChild(videoEl);
        });
        videoElsRef.current = [];

        // Disconnect audio
        sourceNodesRef.current.forEach((s) => { try { s.disconnect(); } catch (_) {} });
        sourceNodesRef.current = [];
        try { audioCtxRef.current?.close(); } catch (_) {}
        audioCtxRef.current = null;

        // Download
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const stamp = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-") + "_" + [
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
        ].join("-");
        const a = document.createElement("a");
        a.href = url;
        a.download = `ZoomClone_recording_${stamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 15_000);
      };

      mr.start(1000);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      console.error("MediaRecorder error:", err);
      cancelAnimationFrame(rafRef.current);
      videoElsRef.current.forEach(({ videoEl }) => {
        videoEl.srcObject = null;
        try { document.body.removeChild(videoEl); } catch (_) {}
      });
    }
  }, [isRecording]);

  // ── PAUSE / RESUME ────────────────────────────────────────────
  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      isPausedRef.current = false;
      setIsPaused(false);
      startTimer();
    } else {
      mediaRecorderRef.current.pause();
      isPausedRef.current = true;
      pausedAtRef.current = duration;
      setIsPaused(true);
      stopTimer();
    }
  }, [isRecording, isPaused, duration]);

  // ── STOP & DOWNLOAD ───────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    stopTimer();
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    isPausedRef.current = false;
    pausedAtRef.current = 0;
    setDuration(0);
  }, []);

  return {
    isRecording, isPaused, duration,
    durationLabel: formatDuration(duration),
    startRecording, pauseRecording, stopRecording,
  };
}
