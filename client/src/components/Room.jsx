import React, { useState, useMemo } from "react";
import { fitTiles, useElementSize } from "../hooks/useTileGrid";
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
import ThemeToggle from "./ThemeToggle";
import InvitePanel from "./InvitePanel";
import RoomPasswordGate from "./RoomPasswordGate";

function PresentationView({ stream, presenterName, iAmPresenting, onStop }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(e => console.error("play error:", e)); } }, [stream]);
  return (
    <div style={{ position:"relative",flex:1,background:"var(--well)",borderRadius:"10px",overflow:"hidden",
      border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",minHeight:0 }}>
      {stream
        ? <video ref={ref} autoPlay playsInline style={{ width:"100%",height:"100%",objectFit:"contain" }} />
        : <div style={{ textAlign:"center",color:"var(--on-well)" }}>
            <Monitor size={48} style={{ marginBottom:"12px" }} />
            <p>Receiving {presenterName}'s screen…</p>
          </div>
      }
      <div style={{ position:"absolute",top:14,left:14,display:"flex",alignItems:"center",gap:"8px",
        background:"var(--chip-dark)",
        borderRadius:"8px",padding:"6px 12px" }}>
        <div style={{ width:8,height:8,borderRadius:"50%",background:"var(--success)",
          animation:"pulse 1.5s infinite" }} />
        <span style={{ color:"#fff",fontSize:"0.82rem",fontWeight:500 }}>
          {iAmPresenting ? "You are presenting" : `${presenterName} is presenting`}
        </span>
      </div>
      {iAmPresenting && (
        <button onClick={onStop} style={{ position:"absolute",top:14,right:14,background:"var(--danger)",
          border:"none",borderRadius:"8px",color:"var(--on-accent)",padding:"8px 16px",
          fontWeight:600,fontSize:"0.85rem",cursor:"pointer" }}>
          Stop Sharing
        </button>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// Stable object references so VideoPlayer's React.memo can actually
// skip re-rendering tiles whose own props haven't changed. The grid tile
// style is derived from the measured container, so it is memoised in the
// component instead of living up here.
const SIDEBAR_TILE_STYLE = { width: "100%", aspectRatio: "16/9", borderRadius: "clamp(8px, 2vw, 12px)" };
const GRID_GAP = 12;

// Room chrome reserves the real toolbar height (published by Controls),
// falling back to a sane value for the first paint.
const BELOW_GRID = `calc(var(--controls-h, 88px) + 12px)`;

function Clock() {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span style={{ color:"var(--text-2)",fontSize:"0.82rem" }}>{t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>;
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
  const [showInvite,         setShowInvite]         = useState(false);

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
    joinError, submitRoomPassword,
  } = useWebRTC(roomId, userName);

  const { isRecording, isPaused, durationLabel, startRecording, pauseRecording, stopRecording } = useRecorder();

  // Measured video area -> tile size. Re-runs when the window resizes, the
  // device rotates, or the chat panel opens and takes width away.
  const [gridRef, gridSize] = useElementSize();

  // Audio routing only — no socket needed
  const { selectedChannelId, selectChannel } = useInterpretation(channels, peers);

  // Filter interpreters out of the visible grid
  const peerList = useMemo(() =>
    Object.entries(peers).filter(([id]) => !interpreterIds.has(id)),
  [peers, interpreterIds]);

  const totalParticipants = 1 + peerList.length;

  const grid = fitTiles(totalParticipants, gridSize.width, gridSize.height, GRID_GAP);
  const gridTileStyle = useMemo(
    () => (grid.ready
      // Explicit px keeps every tile a true 16:9 box. The old style set a
      // minHeight alongside aspectRatio, and the minHeight won — tiles came
      // out at roughly 1.3:1 and object-fit cropped the sides off the video.
      ? { width: `${grid.width}px`, height: `${grid.height}px` }
      : { width: "100%", aspectRatio: "16/9" }),
    [grid.ready, grid.width, grid.height]
  );

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
      justifyContent:"center",background:"var(--bg)",gap:"16px",padding:"24px",textAlign:"center" }}>
      <VideoOff size={48} style={{ color:"var(--danger)" }} />
      <h2 style={{ color:"var(--danger)" }}>Camera / Microphone Error</h2>
      <p style={{ color:"var(--text-2)",maxWidth:"400px" }}>{error}</p>
      <button onClick={() => navigate("/")} style={{ marginTop:"8px",padding:"12px 28px",
        background:"var(--surface-1)",border:"1px solid var(--border-strong)",
        borderRadius:"8px",color:"var(--text-1)",cursor:"pointer",fontFamily:"inherit",fontSize:"0.95rem" }}>
        ← Back to Home
      </button>
    </div>
  );

  if (joinError?.code === "password-required") {
    return <RoomPasswordGate roomId={roomId} onSubmit={submitRoomPassword} />;
  }

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:"var(--bg)",overflow:"hidden" }}>
      {!isConnected && (
        <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
          background:"var(--warn-soft)",color:"var(--warn-text)",padding:"6px 16px",borderRadius:"20px",
          border:"1px solid var(--warn-border)",
          fontSize:"0.8rem",fontWeight:600,zIndex:300 }}>Connecting…</div>
      )}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"clamp(10px, 3vw, 14px) clamp(12px, 4vw, 24px)",borderBottom:"1px solid var(--border)",
        background:"var(--surface-1)",
        flexShrink:0,flexWrap:"wrap",gap:"clamp(8px, 2vw, 12px)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"clamp(6px, 2vw, 10px)",minWidth:0 }}>
          <span style={{ fontWeight:800,
            fontSize:"clamp(0.95rem, 3vw, 1.2rem)",
            color:"var(--text-1)" }}>ZoomClone</span>
          {isAdmin && (
            <span style={{ background:"var(--warn-soft)",border:"1px solid var(--warn-border)",
              borderRadius:"6px",padding:"clamp(2px, 1vw, 3px) clamp(6px, 1vw, 10px)",color:"var(--warn-text)",
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
                background:"var(--success-soft)",border:"1px solid var(--success-border)",
                borderRadius:"6px",padding:"clamp(3px, 1vw, 4px) clamp(6px, 1vw, 10px)",
                fontSize:"clamp(0.65rem, 1.5vw, 0.78rem)",
              }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:"var(--success)",display:"inline-block" }} />
                <span style={{ color:"var(--success-text)",fontWeight:600,whiteSpace:"nowrap" }}>
                  {ch.name}
                </span>
              </div>
            ) : null;
          })()}
          <Clock />
          <span style={{ color:"var(--text-2)",fontSize:"clamp(0.7rem, 1.5vw, 0.82rem)",padding:"clamp(2px, 1vw, 4px) clamp(6px, 1vw, 10px)",
            background:"var(--surface-2)",borderRadius:"6px",
            border:"1px solid var(--border)",whiteSpace:"nowrap" }}>{roomId}</span>
          <ThemeToggle inline />
        </div>
      </div>

      {/* Main */}
      <div className="room-main-shell" style={{ flex:1,display:"flex",overflow:"hidden",minHeight:0 }}>
        {someoneIsPresenting ? (
          <div className="room-presenting-layout" style={{ flex:1,display:"flex",gap:"clamp(8px, 2vw, 12px)",
            padding:`clamp(12px, 3vw, 16px) clamp(12px, 3vw, 16px) ${BELOW_GRID}`,
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
          <div ref={gridRef} className="room-grid-layout" style={{ flex:1,
            padding:"clamp(12px, 3vw, 20px)",
            paddingBottom:BELOW_GRID,
            // Only scroll once tiles have hit their minimum size; otherwise
            // everyone fits and a scrollbar would just be a way to lose people.
            overflowX:"hidden",overflowY:grid.scroll?"auto":"hidden",
            scrollbarGutter:"stable",
            marginRight:showChat?"clamp(280px, 30vw, 340px)":0,
            transition:"margin-right 0.25s",
            display:"flex",alignItems:grid.scroll?"flex-start":"center",justifyContent:"center" }}>
            <div style={{ display:"grid",justifyContent:"center",alignContent:"center",
              gridTemplateColumns:grid.ready?`repeat(${grid.cols}, ${grid.width}px)`:"1fr",
              gap:`${GRID_GAP}px` }}>
              <VideoPlayer stream={localStream} label={userName} isMuted={isMuted}
                isVideoOff={isVideoOff} isLocal={true} isAdmin={isAdmin} speakerId={activeSpeakerId}
                style={gridTileStyle} />
              {peerList.map(([sid,p]) => (
                <VideoPlayer key={sid} peerId={sid} stream={p.stream}
                  label={p.userName||sid.slice(0,6)} isMuted={p.isMuted}
                  isVideoOff={p.isVideoOff} isLocal={false} isAdmin={sid === adminId} speakerId={activeSpeakerId}
                  style={gridTileStyle} />
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
        onOpenInvite={() => setShowInvite(true)}
      />

      {showInvite && (
        <InvitePanel
          roomId={roomId}
          password={searchParams.get("pwd") || ""}
          onClose={() => setShowInvite(false)}
        />
      )}

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
