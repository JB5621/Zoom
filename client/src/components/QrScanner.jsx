
import React, { useCallback, useEffect, useRef, useState } from "react";
import { scanImageData } from "../lib/qrDetect";
import { Camera, ImageIcon, AlertTriangle } from "./icons";

const WORK_EDGE = 640;

const SCAN_INTERVAL_MS = 120;

function cameraUnavailableReason() {
  if (!window.isSecureContext) {
    return "A browser only grants camera access on a secure page. This one is served over plain HTTP, so scanning live is blocked — use a photo instead, or serve the app over HTTPS.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not provide camera access.";
  }
  return null;
}
async function nativeDetector() {
  try {
    if (!("BarcodeDetector" in window)) return null;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    if (!formats.includes("qr_code")) return null;
    return new window.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function describeCameraError(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was denied. Allow it in your browser's site settings, or use a photo instead.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another app.";
    default:
      return err?.message || "The camera could not be started.";
  }
}

/**
 * @param {(text: string) => void} onResult called once, with the payload
 *        of the first code read; the camera is stopped before it fires.
 */
export default function QrScanner({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  // A frame decoded while teardown is in flight must not navigate away.
  const doneRef = useRef(false);
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState("starting");   // starting | scanning | stopped
  const [error, setError] = useState(cameraUnavailableReason());
  const [notice, setNotice] = useState("");
  // Bumped to start the camera over; nothing else re-runs that effect.
  const [attempt, setAttempt] = useState(0);

  // The parent re-renders whenever anything on the dashboard changes, which
  // hands us a fresh onResult each time. Holding it in a ref keeps that out
  // of the scan effect's dependencies, so the camera is not torn down and
  // restarted while someone is simply typing their name.
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const stop = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Draw the current frame into the scratch canvas and return its pixels. */
  const grabFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;

    const scale = Math.min(1, WORK_EDGE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const succeed = useCallback((text) => {
    if (doneRef.current) return;
    doneRef.current = true;
    stop();
    setStatus("stopped");
    onResultRef.current(text);
  }, [stop]);

  // A code can read correctly and still not get anyone into a meeting —
  // an expired room, a link from another server — so scanning has to be
  // restartable without leaving the tab.
  const restart = useCallback(() => {
    doneRef.current = false;
    setError(cameraUnavailableReason());
    setNotice("");
    setStatus("starting");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (cameraUnavailableReason()) return undefined;

    let cancelled = false;

    (async () => {
      const detector = await nativeDetector();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // The rear camera is the one pointed at someone else's screen.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) setError(describeCameraError(err));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try { await video.play(); } catch { /* autoplay is muted+inline, so this is rare */ }
      }
      setStatus("scanning");

      const tick = async () => {
        if (cancelled || doneRef.current) return;
        try {
          if (detector && videoRef.current?.readyState >= 2) {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) return succeed(codes[0].rawValue);
          } else {
            const frame = grabFrame();
            const text = frame && scanImageData(frame);
            if (text) return succeed(text);
          }
        } catch {
          // One unreadable frame is the normal case, not an error; the
          // next one is 120ms away.
        }
        if (!cancelled && !doneRef.current) {
          timerRef.current = setTimeout(tick, SCAN_INTERVAL_MS);
        }
      };
      tick();
    })();

    return () => { cancelled = true; stop(); };
  }, [attempt, grabFrame, stop, succeed]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";               // so picking the same file again re-fires
    if (!file) return;

    setNotice("Reading the picture…");
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      // Big photos are downscaled the same way live frames are, both to
      // bound the work and because the binarizer's block size assumes
      // modules a few pixels across.
      const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();

      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let text = null;
      const detector = await nativeDetector();
      if (detector) {
        const codes = await detector.detect(canvas).catch(() => []);
        text = codes[0]?.rawValue ?? null;
      }
      if (!text) text = scanImageData(image);

      setNotice("");
      if (text) succeed(text);
      else setError("No QR code was found in that picture.");
    } catch {
      setNotice("");
      setError("That file could not be read as an image.");
    }
  }

  const showVideo = !error && status !== "stopped";

  return (
    <div>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3",
        background: "var(--well)", border: "1px solid var(--border)",
        borderRadius: "10px", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview for scanning a meeting QR code"
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            display: showVideo ? "block" : "none",
          }}
        />

        {showVideo && (
          // A plain reticle. It is guidance only — the detector searches
          // the whole frame, so nothing depends on the code sitting in it.
          <div aria-hidden="true" style={{
            position: "absolute", inset: "18%",
            borderRadius: "10px",
            boxShadow: "0 0 0 2px var(--accent)",
            opacity: 0.85, pointerEvents: "none",
          }} />
        )}

        {!showVideo && (
          <div style={{ textAlign: "center", color: "var(--on-well)", padding: "16px" }}>
            {error
              ? <AlertTriangle size={30} />
              : <Camera size={30} />}
            <p style={{ fontSize: "0.8rem", lineHeight: 1.5, margin: "10px 0 0" }}>
              {error || "Camera stopped."}
            </p>
          </div>
        )}

        {showVideo && status === "starting" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "var(--scrim)", color: "var(--on-well)", fontSize: "0.82rem",
          }}>Starting the camera…</div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <p style={{ color: "var(--text-2)", fontSize: "0.8rem", margin: "12px 0 0", lineHeight: 1.5 }}>
        {showVideo
          ? "Point the camera at the QR code from the host's invite panel."
          : "You can still scan a screenshot or photo of the invite QR."}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          width: "100%", marginTop: "12px", minHeight: "44px", padding: "10px",
          background: "var(--surface-2)", border: "1px solid var(--border-strong)",
          borderRadius: "8px", color: "var(--text-1)", fontWeight: 600,
          fontSize: "0.85rem", fontFamily: "inherit", cursor: "pointer",
        }}
      >
        <ImageIcon size={16} /> Scan a photo or screenshot
      </button>

      {!showVideo && (
        <button
          type="button"
          onClick={restart}
          style={{
            display: "block", width: "100%", marginTop: "8px", minHeight: "44px",
            padding: "10px", background: "transparent", border: "none",
            color: "var(--accent-text)", fontWeight: 600, fontSize: "0.85rem",
            fontFamily: "inherit", cursor: "pointer",
          }}
        >
          {error ? "Try the camera again" : "Scan another code"}
        </button>
      )}

      {notice && (
        <p style={{ color: "var(--text-2)", fontSize: "0.8rem", marginTop: "10px", marginBottom: 0 }}>
          {notice}
        </p>
      )}
    </div>
  );
}
