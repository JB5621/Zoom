// ============================================================
// Chat.jsx — Slide-in chat panel
// ============================================================
import React, { useState, useRef, useEffect } from "react";

export default function Chat({ messages, onSend, mySocketId, onClose }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On phones the panel covers the whole screen (including the fixed
  // controls bar underneath), so it needs its own way out.
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div
      className="chat-panel"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: "clamp(280px, 30vw, 340px)",
        background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "clamp(12px, 3vw, 20px) clamp(12px, 3vw, 20px) clamp(10px, 3vw, 16px)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: "clamp(0.9rem, 3vw, 1.05rem)",
            color: "var(--text-1)",
          }}
        >
          Chat
        </span>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-2)",
            width: "clamp(32px, 8vw, 40px)",
            height: "clamp(32px, 8vw, 40px)",
            minWidth: "44px",
            minHeight: "44px",
            cursor: "pointer",
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "inherit",
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "clamp(10px, 2vw, 16px)",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(8px, 1.5vw, 12px)",
        }}
      >
        {messages.length === 0 && (
          <p style={{
            color: "var(--text-3)", fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
            textAlign: "center", marginTop: "40px", fontStyle: "italic"
          }}>
            No messages yet. Be the first to say hello!
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.from === mySocketId;
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                animation: "slideIn 0.3s ease-out",
              }}
            >
              {!isMe && (
                <span style={{
                  color: "var(--text-3)", fontSize: "clamp(0.65rem, 1.5vw, 0.73rem)",
                  marginBottom: "clamp(3px, 1vw, 6px)", fontWeight: 600,
                  letterSpacing: "0.02em"
                }}>
                  {msg.userName}
                </span>
              )}
              <div
                style={{
                  maxWidth: "min(85%, 28rem)",
                  padding: "clamp(8px, 2vw, 11px) clamp(10px, 2vw, 15px)",
                  borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: isMe ? "var(--accent)" : "var(--surface-2)",
                  color: isMe ? "var(--on-accent)" : "var(--text-1)",
                  fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  border: isMe ? "none" : "1px solid var(--border)",
                }}
              >
                {msg.message}
              </div>
              <span style={{
                color: "var(--text-3)", fontSize: "clamp(0.6rem, 1.5vw, 0.68rem)",
                marginTop: "clamp(2px, 0.5vw, 4px)"
              }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "clamp(8px, 2vw, 12px) clamp(10px, 2vw, 16px) clamp(16px, 3vw, 24px)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "clamp(6px, 1.5vw, 8px)",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: "8px",
            padding: "clamp(8px, 2vw, 11px) clamp(10px, 2vw, 15px)",
            color: "var(--text-1)",
            fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
            outline: "none",
            fontFamily: "inherit",
            minHeight: "44px",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent)";
            e.target.style.boxShadow = "var(--ring)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border-strong)";
            e.target.style.boxShadow = "none";
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: "clamp(8px, 2vw, 11px) clamp(10px, 2vw, 16px)",
            background: "var(--accent)",
            border: "none",
            borderRadius: "8px",
            color: "var(--on-accent)",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "clamp(0.8rem, 2vw, 1rem)",
            minHeight: "44px",
            minWidth: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => { e.target.style.background = "var(--accent-hover)"; }}
          onMouseLeave={(e) => { e.target.style.background = "var(--accent)"; }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
