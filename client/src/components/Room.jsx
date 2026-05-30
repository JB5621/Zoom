import React, { useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAuth } from "../context/AuthContext";
import { useRecorder } from "../hooks/useRecorder";
import { useInterpretation } from "../hooks/useInterpretation";
import VideoPlayer from "./VideoPlayer";
import Controls from "./Controls";
import Chat from "./Chat";
import DeviceSelector from "./DeviceSelector";
import SharePicker from "./SharePicker";
import RecordingIndicator from "./RecordingIndicator";
import InterpretationPanel from "./InterpretationPanel";

function PresentationView({ stream, presenterName, iAmPresenting, onStop }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(e => console.error("play error:", e)); } }, [stream]);
  return (
    <div style={{ position:"relative",flex:1,background:"#080810",borderRadius:"16px",overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",minHeight:0 }}>
      {stream
        ? <video ref={ref} autoPlay playsInline style={{ width:"100%",height:"100%",objectFit:"contain" }} />
        : <div style={{ textAlign:"center",color:"#374151" }}>
            <div style={{ fontSize:"3rem",marginBottom:"12px" }}>🖥️</div>
            <p>Receiving {presenterName}'s screen…</p>
          </div>
      }
      <div style={{ position:"absolute",top:14,left:14,display:"flex",alignItems:"center",gap:"8px",
        background:"rgba(42,53,71,0.65)",backdropFilter:"blur(8px)",
        border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",padding:"6px 12px" }}>
        <div style={{ width:8,height:8,borderRadius:"50%",background:"#22c55e",
          boxShadow:"0 0 8px #22c55e",animation:"pulse 1.5s infinite" }} />
        <span style={{ color:"var(--text-1)",fontSize:"0.82rem",fontWeight:500 }}>
          {iAmPresenting ? "You are presenting" : `${presenterName} is presenting`}
        </span>
      </div>
      {iAmPresenting && (
        <button onClick={onStop} style={{ position:"absolute",top:14,right:14,background:"#ef4444",
          border:"none",borderRadius:"10px",color:"#fff",padding:"8px 16px",
          fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:"0.85rem",cursor:"pointer" }}>
          ⏹ Stop Sharing
        </button>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

function Clock() {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span style={{ color:"#6b7280",fontSize:"0.82rem" }}>{t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>;
}

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = searchParams.get("name") || user?.name || "Guest";

  const [showChat,           setShowChat]           = useState(false);
  const [showSettings,       setShowSettings]       = useState(false);
  const [showSharePicker,    setShowSharePicker]    = useState(false);
  const [showInterpretation, setShowInterpretation] = useState(false);

  const {
    localStream, peers, interpreterIds,
    isMuted, isVideoOff, isSharingScreen,
    messages, error, isConnected,
    presenterId, iAmPresenting, presenterPeer, someoneIsPresenting,
    // Interpretation state (from useWebRTC now)
    channels, adminId, isAdmin, adminTokens,
    createChannel, deleteChannel,
    // Devices
    cameras, microphones, speakers,
    activeCameraId, activeMicId, activeSpeakerId,
    switchCamera, switchMicrophone, switchSpeaker,
    toggleMute, toggleVideo,
    startPresentation, stopPresentation,
    sendMessage, leaveRoom,
    mySocketId, socketRef,
  } = useWebRTC(roomId, userName);

  const { isRecording, isPaused, durationLabel, startRecording, pauseRecording, stopRecording } = useRecorder();

  // Audio routing only — no socket needed
  const { selectedChannelId, selectChannel } = useInterpretation(channels, peers);

  // Filter interpreters out of the visible grid
  const peerList = useMemo(() =>
    Object.entries(peers).filter(([id]) => !interpreterIds.has(id)),
  [peers, interpreterIds]);

  const totalParticipants = 1 + peerList.length;

  function handleLeave() {
    if (isRecording) stopRecording();
    leaveRoom();
    navigate("/");
  }

  function handleToggleRecord() {
    if (isRecording) {
      stopRecording();
    } else {
      const participants = [
        { stream: localStream, label: userName, isLocal: true },
        ...peerList.filter(([,p]) => p.stream).map(([,p]) => ({
          stream: p.stream, label: p.userName || "Guest", isLocal: false,
        })),
      ];
      startRecording(participants);
    }
  }

  if (error) return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",background:"linear-gradient(135deg,var(--light-6),var(--accent-2),var(--light-7))",gap:"16px",padding:"24px",textAlign:"center" }}>
      <span style={{ fontSize:"3rem" }}>📵</span>
      <h2 style={{ fontFamily:"'Syne',sans-serif",color:"#ef4444" }}>Camera / Microphone Error</h2>
      <p style={{ color:"var(--light-2)",maxWidth:"400px" }}>{error}</p>
      <button onClick={() => navigate("/")} style={{ marginTop:"8px",padding:"12px 28px",
        background:"var(--light-7)",border:"1px solid var(--light-4)",
        borderRadius:"10px",color:"var(--light-1)",cursor:"pointer",fontFamily:"inherit",fontSize:"0.95rem" }}>
        ← Back to Home
      </button>
    </div>
  );

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:"linear-gradient(135deg,var(--light-6),var(--accent-2),var(--light-7))",overflow:"hidden" }}>
      {!isConnected && (
        <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
          background:"var(--accent-5)",color:"var(--light-1)",padding:"6px 16px",borderRadius:"20px",
          fontSize:"0.8rem",fontWeight:600,zIndex:300 }}>Connecting…</div>
      )}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"clamp(10px, 3vw, 14px) clamp(12px, 4vw, 24px)",borderBottom:"1px solid rgba(255,255,255,0.06)",
        flexShrink:0,flexWrap:"wrap",gap:"clamp(8px, 2vw, 12px)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"clamp(6px, 2vw, 10px)",minWidth:0 }}>
          <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,
            fontSize:"clamp(0.95rem, 3vw, 1.2rem)",
            background:"linear-gradient(135deg,#4af0c8,#0080ff)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>ZoomClone</span>
          {isAdmin && (
            <span style={{ background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.35)",
              borderRadius:"6px",padding:"clamp(2px, 1vw, 3px) clamp(6px, 1vw, 10px)",color:"#fbbf24",
              fontSize:"clamp(0.6rem, 1.5vw, 0.72rem)",
              fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.05em",whiteSpace:"nowrap" }}>
              👑 ADMIN
            </span>
          )}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"clamp(6px, 2vw, 12px)",flexWrap:"wrap" }}>
          {selectedChannelId && (() => {
            const ch = channels.find(c => c.id === selectedChannelId);
            return ch ? (
              <div onClick={() => setShowInterpretation(true)} style={{
                display:"flex",alignItems:"center",gap:"clamp(4px, 1vw, 6px)",cursor:"pointer",
                background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",
                borderRadius:"6px",padding:"clamp(3px, 1vw, 4px) clamp(6px, 1vw, 10px)",
                fontSize:"clamp(0.65rem, 1.5vw, 0.78rem)",
              }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block" }} />
                <span style={{ color:"#4ade80",fontWeight:600,whiteSpace:"nowrap" }}>
                  🌐 {ch.name}
                </span>
              </div>
            ) : null;
          })()}
          <Clock />
          <span style={{ color:"#6b7280",fontSize:"clamp(0.7rem, 1.5vw, 0.82rem)",padding:"clamp(2px, 1vw, 4px) clamp(6px, 1vw, 10px)",
            background:"rgba(255,255,255,0.05)",borderRadius:"6px",
            border:"1px solid rgba(255,255,255,0.08)",whiteSpace:"nowrap" }}>{roomId}</span>
        </div>
      </div>

      {/* Main */}
      <div className="room-main-shell" style={{ flex:1,display:"flex",overflow:"hidden",minHeight:0 }}>
        {someoneIsPresenting ? (
          <div className="room-presenting-layout" style={{ flex:1,display:"flex",gap:"clamp(8px, 2vw, 12px)",
            padding:"clamp(12px, 3vw, 16px) clamp(12px, 3vw, 16px) clamp(80px, 15vw, 90px)",
            overflow:"hidden",minHeight:0,flexDirection:"row",
            marginRight:showChat?"clamp(280px, 30vw, 340px)":0,
            transition:"margin-right 0.25s" }}>
            <PresentationView
              stream={iAmPresenting ? localStream : presenterPeer?.stream || null}
              presenterName={iAmPresenting ? userName : presenterPeer?.userName || "Presenter"}
              iAmPresenting={iAmPresenting} onStop={stopPresentation}
            />
            <div className="room-presenting-sidebar" style={{ width:"clamp(150px, 20vw, 200px)",
              display:"flex",flexDirection:"column",gap:"clamp(6px, 2vw, 10px)",overflowY:"auto",
              flexShrink:0 }}>
              {!iAmPresenting && (
                <VideoPlayer stream={localStream} label={userName} isMuted={isMuted}
                  isVideoOff={isVideoOff} isLocal={true} isAdmin={isAdmin} speakerId={activeSpeakerId}
                  style={{ width:"100%",aspectRatio:"16/9",borderRadius:"clamp(8px, 2vw, 12px)" }} />
              )}
              {peerList.map(([sid,p]) => (
                <VideoPlayer key={sid} peerId={sid} stream={p.stream}
                  label={p.userName||sid.slice(0,6)} isMuted={p.isMuted}
                  isVideoOff={p.isVideoOff} isLocal={false} isAdmin={sid === adminId} speakerId={activeSpeakerId}
                  style={{ width:"100%",aspectRatio:"16/9",borderRadius:"clamp(8px, 2vw, 12px)" }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="room-grid-layout" style={{ flex:1,padding:"clamp(12px, 3vw, 20px)",
            paddingBottom:"clamp(70px, 12vw, 90px)",overflow:"auto",
            marginRight:showChat?"clamp(280px, 30vw, 340px)":0,
            transition:"margin-right 0.25s",position:"relative" }}>
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",
              gap:"clamp(8px, 2vw, 12px)" }}>
              <VideoPlayer stream={localStream} label={userName} isMuted={isMuted}
                isVideoOff={isVideoOff} isLocal={true} isAdmin={isAdmin} speakerId={activeSpeakerId}
                style={{ minHeight:"clamp(120px, 30vh, 180px)",aspectRatio:"16/9" }} />
              {peerList.map(([sid,p]) => (
                <VideoPlayer key={sid} peerId={sid} stream={p.stream}
                  label={p.userName||sid.slice(0,6)} isMuted={p.isMuted}
                  isVideoOff={p.isVideoOff} isLocal={false} isAdmin={sid === adminId} speakerId={activeSpeakerId}
                  style={{ minHeight:"clamp(120px, 30vh, 180px)",aspectRatio:"16/9" }} />
              ))}
            </div>
            {peerList.length === 0 && (
              <div style={{ position:"absolute",top:"50%",left:"50%",
                transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none" }}>
              </div>
            )}
          </div>
        )}

        {showChat && <Chat messages={messages} onSend={sendMessage} mySocketId={mySocketId} />}
      </div>

      <RecordingIndicator isRecording={isRecording} isPaused={isPaused}
        durationLabel={durationLabel} onPause={pauseRecording} onStop={stopRecording} />

      <Controls
        isMuted={isMuted} isVideoOff={isVideoOff} isSharingScreen={isSharingScreen}
        showChat={showChat} isRecording={isRecording}
        isInterpreterActive={!!selectedChannelId}
        onToggleMute={toggleMute} onToggleVideo={toggleVideo}
        onToggleScreen={() => isSharingScreen ? stopPresentation() : setShowSharePicker(true)}
        onToggleChat={() => setShowChat(v => !v)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleRecord={handleToggleRecord}
        onOpenInterpretation={() => setShowInterpretation(true)}
        onLeave={handleLeave}
        participantCount={totalParticipants} roomId={roomId}
      />

      {showSharePicker && (
        <SharePicker
          onShare={s => { setShowSharePicker(false); startPresentation(s); }}
          onClose={() => setShowSharePicker(false)}
        />
      )}

      {showSettings && (
        <DeviceSelector localStream={localStream} cameras={cameras} microphones={microphones}
          speakers={speakers} activeCameraId={activeCameraId} activeMicId={activeMicId}
          activeSpeakerId={activeSpeakerId} onSwitchCamera={switchCamera}
          onSwitchMicrophone={switchMicrophone} onSwitchSpeaker={switchSpeaker}
          onClose={() => setShowSettings(false)} />
      )}

      {showInterpretation && (
        <InterpretationPanel
          isAdmin={isAdmin} channels={channels} adminTokens={adminTokens}
          selectedChannelId={selectedChannelId}
          onSelectChannel={selectChannel}
          onCreateChannel={createChannel}
          onDeleteChannel={id => { deleteChannel(id); if (selectedChannelId === id) selectChannel(null); }}
          onClose={() => setShowInterpretation(false)}
        />
      )}

      {/* Hidden audio elements for interpreters — enable audio routing */}
      {Array.from(interpreterIds).map(id => {
        const interp = peers[id];
        if (!interp?.stream) return null;
        return (
          <audio
            key={id}
            ref={ref => {
              if (ref && interp.stream) ref.srcObject = interp.stream;
            }}
            autoPlay
            data-peer-id={id}
            style={{ display: "none" }}
          />
        );
      })}
    </div>
  );
}
