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
import { Monitor, VideoOff } from "./icons";

function PresentationView({ stream, presenterName, iAmPresenting, onStop }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(e => console.error("play error:", e)); } }, [stream]);
  return (
    <div style={{ position:"relative",flex:1,background:"#18181D",borderRadius:"10px",overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",minHeight:0 }}>
      {stream
        ? <video ref={ref} autoPlay playsInline style={{ width:"100%",height:"100%",objectFit:"contain" }} />
        : <div style={{ textAlign:"center",color:"#38BDF8" }}>
            <Monitor size={48} style={{ marginBottom:"12px" }} />
            <p>Receiving {presenterName}'s screen…</p>
          </div>
      }
      <div style={{ position:"absolute",top:14,left:14,display:"flex",alignItems:"center",gap:"8px",
        background:"rgba(17,24,39,0.75)",
        borderRadius:"8px",padding:"6px 12px" }}>
        <div style={{ width:8,height:8,borderRadius:"50%",background:"#22c55e",
          animation:"pulse 1.5s infinite" }} />
        <span style={{ color:"#fff",fontSize:"0.82rem",fontWeight:500 }}>
          {iAmPresenting ? "You are presenting" : `${presenterName} is presenting`}
        </span>
      </div>
      {iAmPresenting && (
        <button onClick={onStop} style={{ position:"absolute",top:14,right:14,background:"#DC2626",
          border:"none",borderRadius:"8px",color:"#fff",padding:"8px 16px",
          fontWeight:600,fontSize:"0.85rem",cursor:"pointer" }}>
          Stop Sharing
        </button>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// Stable object references so VideoPlayer's React.memo can actually
// skip re-rendering tiles whose own props haven't changed.
const GRID_TILE_STYLE = { minHeight: "clamp(160px, 46vh, 420px)", maxWidth: "480px", aspectRatio: "16/9" };
const SIDEBAR_TILE_STYLE = { width: "100%", aspectRatio: "16/9", borderRadius: "clamp(8px, 2vw, 12px)" };

function Clock() {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span style={{ color:"#0369A1",fontSize:"0.82rem" }}>{t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>;
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
      justifyContent:"center",background:"#EFF8FF",gap:"16px",padding:"24px",textAlign:"center" }}>
      <VideoOff size={48} style={{ color:"#DC2626" }} />
      <h2 style={{ color:"#DC2626" }}>Camera / Microphone Error</h2>
      <p style={{ color:"#0369A1",maxWidth:"400px" }}>{error}</p>
      <button onClick={() => navigate("/")} style={{ marginTop:"8px",padding:"12px 28px",
        background:"#FFFFFF",border:"1px solid #7DD3FC",
        borderRadius:"8px",color:"#0C4A6E",cursor:"pointer",fontFamily:"inherit",fontSize:"0.95rem" }}>
        ← Back to Home
      </button>
    </div>
  );

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:"#EFF8FF",overflow:"hidden" }}>
      {!isConnected && (
        <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
          background:"#FFFBEB",color:"#92400E",padding:"6px 16px",borderRadius:"20px",
          border:"1px solid #FDE68A",
          fontSize:"0.8rem",fontWeight:600,zIndex:300 }}>Connecting…</div>
      )}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"clamp(10px, 3vw, 14px) clamp(12px, 4vw, 24px)",borderBottom:"1px solid #BAE6FD",
        background:"#FFFFFF",
        flexShrink:0,flexWrap:"wrap",gap:"clamp(8px, 2vw, 12px)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"clamp(6px, 2vw, 10px)",minWidth:0 }}>
          <span style={{ fontWeight:800,
            fontSize:"clamp(0.95rem, 3vw, 1.2rem)",
            color:"#0C4A6E" }}>ZoomClone</span>
          {isAdmin && (
            <span style={{ background:"#FFFBEB",border:"1px solid #FDE68A",
              borderRadius:"6px",padding:"clamp(2px, 1vw, 3px) clamp(6px, 1vw, 10px)",color:"#D97706",
              fontSize:"clamp(0.6rem, 1.5vw, 0.72rem)",
              fontWeight:700,letterSpacing:"0.05em",whiteSpace:"nowrap" }}>
              ADMIN
            </span>
          )}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"clamp(6px, 2vw, 12px)",flexWrap:"wrap" }}>
          {selectedChannelId && (() => {
            const ch = channels.find(c => c.id === selectedChannelId);
            return ch ? (
              <div onClick={() => setShowInterpretation(true)} style={{
                display:"flex",alignItems:"center",gap:"clamp(4px, 1vw, 6px)",cursor:"pointer",
                background:"#F0FDF4",border:"1px solid #BBF7D0",
                borderRadius:"6px",padding:"clamp(3px, 1vw, 4px) clamp(6px, 1vw, 10px)",
                fontSize:"clamp(0.65rem, 1.5vw, 0.78rem)",
              }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:"#16A34A",display:"inline-block" }} />
                <span style={{ color:"#15803D",fontWeight:600,whiteSpace:"nowrap" }}>
                  {ch.name}
                </span>
              </div>
            ) : null;
          })()}
          <Clock />
          <span style={{ color:"#0369A1",fontSize:"clamp(0.7rem, 1.5vw, 0.82rem)",padding:"clamp(2px, 1vw, 4px) clamp(6px, 1vw, 10px)",
            background:"#E0F2FE",borderRadius:"6px",
            border:"1px solid #BAE6FD",whiteSpace:"nowrap" }}>{roomId}</span>
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
                  style={SIDEBAR_TILE_STYLE} />
              )}
              {peerList.map(([sid,p]) => (
                <VideoPlayer key={sid} peerId={sid} stream={p.stream}
                  label={p.userName||sid.slice(0,6)} isMuted={p.isMuted}
                  isVideoOff={p.isVideoOff} isLocal={false} isAdmin={sid === adminId} speakerId={activeSpeakerId}
                  style={SIDEBAR_TILE_STYLE} />
              ))}
            </div>
          </div>
        ) : (
          <div className="room-grid-layout" style={{ flex:1,padding:"clamp(12px, 3vw, 20px)",
            paddingBottom:"clamp(70px, 12vw, 90px)",overflow:"auto",
            marginRight:showChat?"clamp(280px, 30vw, 340px)":0,
            transition:"margin-right 0.25s",
            display:"flex",alignItems:"safe center",justifyContent:"center" }}>
            <div style={{ display:"grid",width:"100%",justifyContent:"center",
              gridTemplateColumns:"repeat(auto-fit, minmax(160px, 480px))",
              gap:"clamp(8px, 2vw, 12px)" }}>
              <VideoPlayer stream={localStream} label={userName} isMuted={isMuted}
                isVideoOff={isVideoOff} isLocal={true} isAdmin={isAdmin} speakerId={activeSpeakerId}
                style={GRID_TILE_STYLE} />
              {peerList.map(([sid,p]) => (
                <VideoPlayer key={sid} peerId={sid} stream={p.stream}
                  label={p.userName||sid.slice(0,6)} isMuted={p.isMuted}
                  isVideoOff={p.isVideoOff} isLocal={false} isAdmin={sid === adminId} speakerId={activeSpeakerId}
                  style={GRID_TILE_STYLE} />
              ))}
            </div>
          </div>
        )}

        {showChat && <Chat messages={messages} onSend={sendMessage} mySocketId={mySocketId} onClose={() => setShowChat(false)} />}
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
