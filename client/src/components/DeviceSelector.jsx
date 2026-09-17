// ============================================================
// DeviceSelector.jsx — Settings modal for camera/mic/speaker
// ============================================================
import React, { useRef, useEffect, useState } from "react";
import { Camera, Mic, Volume2 } from "./icons";

// ── Reusable dropdown ─────────────────────────────────────────
function DeviceDropdown({ label, icon, devices, activeId, onChange, disabled }) {
  return (
    <div style={{ marginBottom: "clamp(16px, 3vw, 28px)" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(6px, 2vw, 10px)",
          color: "var(--text-2)",
          fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "clamp(8px, 2vw, 12px)",
        }}
      >
        <span style={{ display: "flex" }}>{icon}</span>
        {label}
      </label>

      {devices.length === 0 ? (
        <div
          style={{
            padding: "clamp(10px, 2vw, 14px) clamp(12px, 2vw, 16px)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-3)",
            fontSize: "clamp(0.75rem, 2vw, 0.85rem)",
            textAlign: "center",
          }}
        >
          No devices found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(4px, 1vw, 8px)" }}>
          {devices.map((device, i) => {
            const isActive = device.deviceId === activeId;
            return (
              <button
                key={device.deviceId}
                onClick={() => !disabled && onChange(device.deviceId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "clamp(8px, 2vw, 12px)",
                  padding: "clamp(10px, 2vw, 13px) clamp(12px, 2vw, 16px)",
                  background: isActive ? "var(--accent-soft)" : "var(--surface-2)",
                  border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "8px",
                  color: isActive ? "var(--accent-text)" : "var(--text-1)",
                  cursor: disabled ? "default" : "pointer",
                  textAlign: "left",
                  width: "100%",
                  fontFamily: "inherit",
                  fontSize: "clamp(0.8rem, 2vw, 0.95rem)",
                  minHeight: "44px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !disabled) {
                    e.currentTarget.style.background = "var(--surface-3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--surface-2)";
                  }
                }}
              >
                {/* Active indicator */}
                <div
                  style={{
                    width: "clamp(6px, 1vw, 8px)",
                    height: "clamp(6px, 1vw, 8px)",
                    borderRadius: "50%",
                    background: isActive ? "var(--accent)" : "var(--border-strong)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {device.label || `Device ${i + 1}`}
                </span>
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)",
                      color: "var(--accent-text)",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Preview video element ─────────────────────────────────────
function CameraPreview({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div
      style={{
        position: "relative",
        background: "var(--well)",
        borderRadius: "10px",
        overflow: "hidden",
        marginBottom: "clamp(16px, 3vw, 24px)",
        aspectRatio: "16/9",
        border: "1px solid var(--border)",
      }}
    >
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          display: "block",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "clamp(4px, 1vw, 8px)",
          left: "clamp(6px, 1.5vw, 10px)",
          fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)",
          color: "var(--on-well)",
          background: "var(--chip-dark)",
          padding: "clamp(1px, 0.5vw, 2px) clamp(4px, 1vw, 8px)",
          borderRadius: "4px",
        }}
      >
        Preview
      </div>
    </div>
  );
}

// ── Mic level meter ───────────────────────────────────────────
function MicMeter({ stream }) {
  const [level, setLevel] = useState(0);
  const animRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!stream) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.min(100, avg * 2.5));
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      source.disconnect();
      audioCtx.close();
    };
  }, [stream]);

  const bars = 20;
  return (
    <div style={{ marginBottom: "24px" }}>
      <label
        style={{
          display: "block",
          color: "var(--text-2)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "10px",
        }}
      >
        Mic Level
      </label>
      <div
        style={{
          display: "flex",
          gap: "3px",
          alignItems: "flex-end",
          height: "28px",
          padding: "4px 8px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
        }}
      >
        {Array.from({ length: bars }).map((_, i) => {
          const threshold = (i / bars) * 100;
          const active = level > threshold;
          const color = i < bars * 0.6 ? "var(--success)" : i < bars * 0.8 ? "var(--warn-text)" : "var(--danger)";
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${40 + i * 3}%`,
                borderRadius: "2px",
                background: active ? color : "var(--border-strong)",
                transition: "background 0.05s",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────
export default function DeviceSelector({
  localStream,
  cameras,
  microphones,
  speakers,
  activeCameraId,
  activeMicId,
  activeSpeakerId,
  onSwitchCamera,
  onSwitchMicrophone,
  onSwitchSpeaker,
  onClose,
}) {
  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: "clamp(12px, 3vw, 16px)",
      }}
    >
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "clamp(280px, 90vw, 480px)",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px) clamp(10px, 3vw, 16px)",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--surface-1)",
            zIndex: 1,
            gap: "clamp(8px, 2vw, 12px)",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "clamp(0.9rem, 3vw, 1.05rem)",
                color: "var(--text-1)",
              }}
            >
              Audio & Video Settings
            </div>
            <div style={{ color: "var(--text-2)", fontSize: "clamp(0.7rem, 1.5vw, 0.78rem)", marginTop: "clamp(1px, 0.5vw, 2px)" }}>
              Changes apply instantly to your call
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text-2)",
              width: "clamp(32px, 8vw, 40px)",
              height: "clamp(32px, 8vw, 40px)",
              cursor: "pointer",
              fontSize: "clamp(0.8rem, 2vw, 1rem)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              minWidth: "44px",
              minHeight: "44px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "clamp(14px, 3vw, 20px) clamp(16px, 3vw, 24px) clamp(16px, 3vw, 24px)" }}>
          {/* Camera preview */}
          <CameraPreview stream={localStream} />

          {/* Camera select */}
          <DeviceDropdown
            label="Camera"
            icon={<Camera size={16} />}
            devices={cameras}
            activeId={activeCameraId}
            onChange={onSwitchCamera}
          />

          {/* Mic level meter */}
          <MicMeter stream={localStream} />

          {/* Mic select */}
          <DeviceDropdown
            label="Microphone"
            icon={<Mic size={16} />}
            devices={microphones}
            activeId={activeMicId}
            onChange={onSwitchMicrophone}
          />

          {/* Speaker select */}
          <DeviceDropdown
            label="Speaker / Headphones"
            icon={<Volume2 size={16} />}
            devices={speakers}
            activeId={activeSpeakerId}
            onChange={onSwitchSpeaker}
          />

          {speakers.length === 0 && (
            <p style={{ color: "var(--text-3)", fontSize: "0.78rem", marginTop: "-16px" }}>
              Speaker selection requires Chrome or Edge.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
