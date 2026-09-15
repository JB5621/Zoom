// ============================================================
// Controls.jsx — Bottom toolbar: mic, camera, screen, leave
// ============================================================
import React from "react";
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
          ? "#DC2626"
          : active
          ? "#F0F9FF"
          : "#E0F2FE",
        border: "1px solid",
        borderColor: danger
          ? "#DC2626"
          : active
          ? "#BAE6FD"
          : "#BAE6FD",
        borderRadius: "10px",
        color: danger ? "#FFFFFF" : active ? "#0EA5E9" : "#0C4A6E",
        cursor: "pointer",
        minWidth: "clamp(44px, 10vw, 66px)",
        minHeight: "44px",
        fontFamily: "inherit",
        fontSize: "clamp(0.8rem, 1.5vw, 0.95rem)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#B91C1C" : active ? "#E0F2FE" : "#BAE6FD";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = danger ? "#DC2626" : active ? "#F0F9FF" : "#E0F2FE";
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
  onOpenInterpretation, onLeave,
  participantCount, roomId,
}) {
  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "clamp(12px, 3vw, 16px) clamp(12px, 5vw, 24px) clamp(16px, 4vw, 24px)",
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(6px, 2vw, 10px)",
        zIndex: 100,
        borderTop: "1px solid #BAE6FD",
        flexWrap: "wrap",
      }}
    >
      {/* Room code badge — inline on small/mid screens, pinned to the
          left edge only once the toolbar is wide enough (see index.css) */}
      <div
        className="controls-room-badge"
        onClick={copyLink}
        title="Click to copy meeting link"
        style={{
          background: "#E0F2FE",
          border: "1px solid #BAE6FD",
          borderRadius: "10px",
          padding: "clamp(6px, 1.5vw, 10px) clamp(10px, 2vw, 16px)",
          cursor: "pointer",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#BAE6FD"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#E0F2FE"; }}
      >
        <span style={{ color: "#38BDF8", fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)", fontWeight: 600, letterSpacing: "0.05em" }}>
          ROOM
        </span>
        <span
          style={{
            color: "#0EA5E9",
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
