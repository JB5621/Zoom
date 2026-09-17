// ============================================================
// Controls.jsx — Bottom toolbar: mic, camera, screen, leave
// ============================================================
import React, { useLayoutEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageCircle, Settings, RecordDot, StopSquare, Globe, PhoneOff, Users } from "./icons";

function Btn({ onClick, active, danger, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "clamp(2px, 1vw, 4px)",
        padding: "clamp(10px, 2vw, 12px) clamp(12px, 3vw, 18px)",
        background: danger
          ? "var(--danger)"
          : active
          ? "var(--accent-soft)"
          : "var(--surface-2)",
        border: "1px solid",
        borderColor: danger
          ? "var(--danger)"
          : active
          ? "var(--accent)"
          : "var(--border)",
        borderRadius: "10px",
        color: danger ? "var(--on-accent)" : active ? "var(--accent-text)" : "var(--text-1)",
        cursor: "pointer",
        minWidth: "clamp(44px, 10vw, 66px)",
        minHeight: "44px",
        fontFamily: "inherit",
        fontSize: "clamp(0.8rem, 1.5vw, 0.95rem)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "var(--danger-hover)" : active ? "var(--accent-soft-hover)" : "var(--surface-3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = danger ? "var(--danger)" : active ? "var(--accent-soft)" : "var(--surface-2)";
      }}
    >
      <span style={{ display: "flex" }}>{children}</span>
    </button>
  );
}

export default function Controls({
  isMuted, isVideoOff, isSharingScreen, showChat,
  isRecording, isInterpreterActive,
  onToggleMute, onToggleVideo, onToggleScreen,
  onToggleChat, onOpenSettings, onToggleRecord,
  onOpenInterpretation, onLeave, onOpenInvite,
  participantCount, roomId,
}) {
  const barRef = useRef(null);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const publish = (h) =>
      document.documentElement.style.setProperty("--controls-h", `${Math.ceil(h)}px`);
    // Border box, not contentRect: the bar carries ~40px of its own padding
    // and it is the full painted height the video area has to clear.
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      publish(box ? box.blockSize : el.getBoundingClientRect().height);
    });
    ro.observe(el);
    publish(el.getBoundingClientRect().height);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--controls-h");
    };
  }, []);

  // Opens the invite panel rather than copying silently: a bare copy gave
  // no feedback and hid the QR and password entirely.
  const openInvite = onOpenInvite || (() => navigator.clipboard.writeText(window.location.href));

  return (
    <div
      ref={barRef}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "clamp(12px, 3vw, 16px) clamp(12px, 5vw, 24px) clamp(16px, 4vw, 24px)",
        background: "var(--surface-1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(6px, 2vw, 10px)",
        zIndex: 100,
        borderTop: "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      {/* Room code badge — inline on small/mid screens, pinned to the
          left edge only once the toolbar is wide enough (see index.css) */}
      <div
        className="controls-room-badge"
        onClick={openInvite}
        title="Show invite link, QR code and room code"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "clamp(6px, 1.5vw, 10px) clamp(10px, 2vw, 16px)",
          cursor: "pointer",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
      >
        <span style={{ color: "var(--text-3)", fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)", fontWeight: 600, letterSpacing: "0.05em" }}>
          ROOM
        </span>
        <span
          style={{
            color: "var(--accent-text)",
            fontSize: "clamp(0.75rem, 1.5vw, 0.88rem)",
            fontWeight: 700,
            letterSpacing: "0.12em",
            marginTop: "clamp(2px, 0.5vw, 4px)",
          }}
        >
          {roomId}
        </span>
      </div>

      {/* Center controls */}
      <Btn onClick={onToggleMute} active={isMuted} title={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? <MicOff /> : <Mic />}
      </Btn>

      <Btn onClick={onToggleVideo} active={isVideoOff} title={isVideoOff ? "Start Video" : "Stop Video"}>
        {isVideoOff ? <VideoOff /> : <Video />}
      </Btn>

      <Btn onClick={onToggleScreen} active={isSharingScreen} title={isSharingScreen ? "Stop Sharing" : "Share Screen"}>
        {isSharingScreen ? <MonitorOff /> : <Monitor />}
      </Btn>

      <Btn onClick={onToggleChat} active={showChat} title="Chat">
        <MessageCircle />
      </Btn>

      <Btn onClick={onOpenSettings} title="Audio & Video Settings">
        <Settings />
      </Btn>

      <Btn onClick={onToggleRecord} active={isRecording} title={isRecording ? "Stop Recording" : "Start Recording"}>
        {isRecording ? <StopSquare /> : <RecordDot />}
      </Btn>

      <Btn onClick={onOpenInterpretation} active={isInterpreterActive} title="Language Interpretation">
        <Globe />
      </Btn>

      <Btn onClick={onLeave} danger title="Leave Meeting">
        <PhoneOff />
      </Btn>

      {/* Participant count — inline pill on small/mid screens, pinned
          to the right edge only once the toolbar is wide enough */}
      <div className="controls-participant-count">
        <Users size={16} />
        <span>{participantCount}</span>
      </div>
    </div>
  );
}
