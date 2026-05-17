// ============================================================
// Chat.jsx — Slide-in chat panel
// ============================================================
import React, { useState, useRef, useEffect } from "react";

export default function Chat({ messages, onSend, mySocketId }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: window.innerWidth < 640 ? "100%" : "clamp(280px, 30vw, 340px)",
        background: "rgba(13,13,24,0.8)",
        backdropFilter: "blur(15px)",
        borderLeft: "1.5px solid rgba(0,128,255,0.2)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "clamp(12px, 3vw, 20px) clamp(12px, 3vw, 20px) clamp(10px, 3vw, 16px)",
          borderBottom: "1.5px solid rgba(0,128,255,0.1)",
          background: "rgba(0,128,255,0.05)",
        }}
      >
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(0.9rem, 3vw, 1.05rem)",
            color: "#e8e8f0",
            letterSpacing: "0.02em",
          }}
        >
          💬 Chat
        </span>
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
            color: "#4b5563", fontSize: "clamp(0.8rem, 2vw, 0.88rem)", 
            textAlign: "center", marginTop: "40px", fontStyle: "italic" 
          }}>
            👋 No messages yet. Be the first to say hello!
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
                  color: "#9ca3af", fontSize: "clamp(0.65rem, 1.5vw, 0.73rem)", 
                  marginBottom: "clamp(3px, 1vw, 6px)", fontWeight: 600, 
                  letterSpacing: "0.02em" 
                }}>
                  {msg.userName}
                </span>
              )}
              <div
                style={{
                  maxWidth: window.innerWidth < 640 ? "90%" : "85%",
                  padding: "clamp(8px, 2vw, 11px) clamp(10px, 2vw, 15px)",
                  borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isMe
                    ? "linear-gradient(135deg, #0080ff 0%, #00b4ff 100%)"
                    : "rgba(255,255,255,0.08)",
                  color: "#e8e8f0",
                  fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  boxShadow: isMe
                    ? "0 4px 12px rgba(0,128,255,0.2)"
                    : "none",
                  border: isMe
                    ? "none"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {msg.message}
              </div>
              <span style={{ 
                color: "#374151", fontSize: "clamp(0.6rem, 1.5vw, 0.68rem)", 
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
          borderTop: "1.5px solid rgba(0,128,255,0.1)",
          display: "flex",
          gap: "clamp(6px, 1.5vw, 8px)",
          background: "rgba(0,128,255,0.02)",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(0,128,255,0.2)",
            borderRadius: "clamp(8px, 2vw, 12px)",
            padding: "clamp(8px, 2vw, 11px) clamp(10px, 2vw, 15px)",
            color: "#e8e8f0",
            fontSize: "clamp(0.8rem, 2vw, 0.88rem)",
            outline: "none",
            fontFamily: "inherit",
            transition: "all 0.2s ease",
            minHeight: "44px",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(0,200,255,0.5)";
            e.target.style.boxShadow = "0 0 0 3px rgba(0,200,255,0.1)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(0,128,255,0.2)";
            e.target.style.boxShadow = "none";
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: "clamp(8px, 2vw, 11px) clamp(10px, 2vw, 16px)",
            background: "linear-gradient(135deg, #0080ff, #00c8ff)",
            border: "none",
            borderRadius: "clamp(8px, 2vw, 12px)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "clamp(0.8rem, 2vw, 1rem)",
            transition: "all 0.2s ease",
            boxShadow: "0 4px 12px rgba(0,128,255,0.2)",
            minHeight: "44px",
            minWidth: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 8px 20px rgba(0,128,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 12px rgba(0,128,255,0.2)";
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
