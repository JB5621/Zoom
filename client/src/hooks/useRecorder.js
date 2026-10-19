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
function drawTile(ctx, videoEl, rect, label, isLocal, isPresenting) {
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
    const scale = (isPresenting ? Math.min : Math.max)(w / vw, videoH / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const sx = x + (w - sw) / 2;
    const sy = y + (videoH - sh) / 2;

    if (isLocal && !isPresenting) {
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
    ctx.fillStyle = "#0EA5E9";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 0.8}px Inter, sans-serif`;
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
  ctx.font = "500 14px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    (label || "Unknown") + (isLocal ? " (You)" : ""),
    x + 12, y + videoH + LABEL_HEIGHT / 2,
    w - 24
  );
}

export function useRecorder(participants = [], ended = false) {
  const session = useRef(null);
  const participantsRef = useRef(participants);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingError, setRecordingError] = useState('');

  const syncParticipants = useCallback((list) => {
    const current = session.current;
    if (!current) return;
    const wanted = new Set();
    for (const p of list) {
      if (!p.stream) continue;
      const key = p.id || p.label;
      wanted.add(key);
      let entry = current.entries.get(key);
      const signature = p.stream.getTracks().map(t => t.id).join(',');
      if (entry && entry.signature === signature) { entry.label = p.label; entry.isPresenting = p.isPresenting; continue; }
      if (entry) { entry.videoEl.srcObject = null; entry.sources?.forEach(source => source.disconnect()); }
      const videoEl = entry?.videoEl || document.createElement('video');
      videoEl.muted = true; videoEl.autoplay = true; videoEl.playsInline = true;
      videoEl.srcObject = p.stream; videoEl.play().catch(() => {});
      const sources = p.stream.getAudioTracks().map(track => {
        const source = current.context.createMediaStreamSource(new MediaStream([track]));
        source.connect(current.destination);
        return source;
      });
      current.entries.set(key, { ...p, signature, videoEl, sources });
    }
    for (const [key, entry] of current.entries) if (!wanted.has(key)) {
      entry.videoEl.srcObject = null; entry.sources?.forEach(source => source.disconnect()); current.entries.delete(key);
    }
  }, []);

  useEffect(() => { participantsRef.current = participants; syncParticipants(participants); }, [participants, syncParticipants]);

  const stopRecording = useCallback(() => {
    const current = session.current;
    if (!current) return;
    if (current.recorder.state !== 'inactive') current.recorder.stop();
    clearInterval(current.timer); cancelAnimationFrame(current.frame);
    session.current = null;
    setIsRecording(false); setIsPaused(false);
  }, []);
  useEffect(() => { if (ended) stopRecording(); }, [ended, stopRecording]);
  useEffect(() => () => { stopRecording(); }, [stopRecording]);
  useEffect(() => {
    if (!isRecording) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (session.current) return;
    setRecordingError('');
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      setRecordingError('Recording is unavailable in this browser.'); return;
    }
    let current;
    try {
      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const canvas = document.createElement('canvas'); canvas.width = CANVAS_W; canvas.height = CANVAS_H;
      const captured = canvas.captureStream(FPS);
      const composite = new MediaStream([...captured.getVideoTracks(), ...destination.stream.getAudioTracks()]);
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      current = { context, destination, composite, entries: new Map(), chunks: [], elapsed: 0, lastTick: Date.now() };
      const recorder = new MediaRecorder(composite, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 3000000 });
      current.recorder = recorder; session.current = current;
      const release = () => {
        cancelAnimationFrame(current.frame); clearInterval(current.timer);
        for (const e of current.entries.values()) { e.videoEl.srcObject = null; e.sources?.forEach(source => source.disconnect()); }
        composite.getTracks().forEach(t => t.stop()); context.close();
      };
      recorder.ondataavailable = event => { if (event.data.size) current.chunks.push(event.data); };
      recorder.onerror = () => { setRecordingError('Recording stopped unexpectedly. Saving the captured portion.'); stopRecording(); };
      recorder.onstop = () => {
        release();
        if (!current.chunks.length) return;
        const type = recorder.mimeType || 'video/webm';
        const blob = new Blob(current.chunks, { type });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `Oguz_Meeting_${new Date().toISOString().replace(/[:.]/g, '-')}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
      await context.resume();
      if (session.current !== current) { release(); return; }
      syncParticipants(participantsRef.current);
      const ctx = canvas.getContext('2d');
      const frame = () => {
        if (recorder.state !== 'paused') {
          ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          const entries = [...current.entries.values()]; const tiles = buildGrid(entries.length);
          entries.forEach((e, i) => drawTile(ctx, e.videoEl, tiles[i], e.label, e.isLocal, e.isPresenting));
        }
        current.frame = requestAnimationFrame(frame);
      };
      recorder.start(1000); frame();
      current.timer = setInterval(() => {
        const now = Date.now();
        if (recorder.state === 'recording') current.elapsed += now - current.lastTick;
        current.lastTick = now; setDuration(Math.floor(current.elapsed / 1000));
      }, 250);
      setDuration(0); setIsRecording(true); setIsPaused(false);
    } catch (error) {
      current?.composite?.getTracks().forEach(t => t.stop()); current?.context?.close(); session.current = null;
      setRecordingError(error.message);
    }
  }, [syncParticipants, stopRecording]);
  const pauseRecording = useCallback(() => {
    const recorder = session.current?.recorder;
    if (!recorder) return;
    if (recorder.state === 'paused') { recorder.resume(); setIsPaused(false); }
    else if (recorder.state === 'recording') { recorder.pause(); setIsPaused(true); }
  }, []);
  return { isRecording, isPaused, duration, recordingError,
    durationLabel: `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`,
    startRecording, stopRecording, pauseRecording };
}
