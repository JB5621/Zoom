import React, { useState, useMemo } from "react";
import PreJoin from './PreJoin';
import MeetingStage from './MeetingStage';
import MeetingTools from './MeetingTools';
import MeetingChat from './MeetingChat';
import { useMeetingFeatures } from '../hooks/useMeetingFeatures';
import './meeting.css';
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAuth } from "../context/AuthState";
import { useRecorder } from "../hooks/useRecorder";
import { useInterpretation } from "../hooks/useInterpretation";
import Controls from "./Controls";
import DeviceSelector from "./DeviceSelector";
import SharePicker from "./SharePicker";
import RecordingIndicator from "./RecordingIndicator";
import InterpretationPanel from "./InterpretationPanel";
import { VideoOff, PhoneOff, LogOut, Home } from "./icons";
import ThemeToggle from "./ThemeToggle";
import InvitePanel from "./InvitePanel";
import RoomPasswordGate from "./RoomPasswordGate";

/**
 * The host's way out. Ending the meeting cannot be undone and takes
 * everyone else with it, so the two outcomes are named rather than hidden
 * behind one button, and neither is the default action.
 */
function LeavePrompt({ participantCount, onEndForEveryone, onJustLeave, onCancel }) {
  const others = participantCount === 1 ? "1 other person" : `${participantCount} other people`;
  const button = {
    width: "100%", minHeight: "44px", padding: "12px",
    borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
    fontWeight: 600, fontSize: "0.9rem", marginBottom: "10px",
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      style={{ position:"fixed",inset:0,background:"var(--scrim)",display:"flex",
        alignItems:"center",justifyContent:"center",zIndex:600,padding:"clamp(12px, 3vw, 16px)" }}
    >
      <div style={{ background:"var(--surface-1)",border:"1px solid var(--border)",
        borderRadius:"14px",padding:"clamp(20px, 5vw, 26px)",width:"100%",
        maxWidth:"min(380px, 92vw)",boxShadow:"var(--shadow-modal)" }}>
        <div style={{ fontWeight:700,fontSize:"clamp(0.95rem, 3vw, 1.1rem)",
          color:"var(--text-1)",marginBottom:"6px" }}>Leave this meeting?</div>
        <p style={{ color:"var(--text-2)",fontSize:"0.85rem",lineHeight:1.5,margin:"0 0 18px" }}>
          You are the host, and {others} {participantCount === 1 ? "is" : "are"} still here.
        </p>

        <button
          className="icon-btn"
          onClick={onEndForEveryone}
          style={{ ...button, background:"var(--danger)",border:"1px solid var(--danger)",
            color:"var(--on-accent)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--danger)"; }}
        >
          <PhoneOff size={16} /> End for everyone
        </button>
        <p style={{ color:"var(--text-3)",fontSize:"0.76rem",lineHeight:1.5,margin:"-4px 0 14px" }}>
          Removes everyone and closes the room. The code stops working.
        </p>

        <button
          className="icon-btn"
          onClick={onJustLeave}
          style={{ ...button, background:"var(--surface-2)",
            border:"1px solid var(--border-strong)",color:"var(--text-1)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
        >
          <LogOut size={16} /> Just leave
        </button>
        <p style={{ color:"var(--text-3)",fontSize:"0.76rem",lineHeight:1.5,margin:"-4px 0 14px" }}>
          The meeting carries on without you and someone else becomes host.
        </p>

        <button
          onClick={onCancel}
          style={{ ...button, marginBottom:0,background:"transparent",border:"none",
            color:"var(--text-2)",fontWeight:500 }}
        >
          Stay in the meeting
        </button>
      </div>
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  return <MeetingEntry key={roomId} />;
}
function MeetingEntry() {
  const [media, setMedia] = useState(null);
  const { user } = useAuth();
  return media ? <RoomCall initialMedia={media} /> : <PreJoin name={user?.name || 'Guest'} onJoin={setMedia} />;
}
function RoomCall({ initialMedia }) {
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
  // Only the host is asked anything on the way out, and only because one
  // of the choices cannot be undone.
  const [showLeavePrompt,    setShowLeavePrompt]    = useState(false);

  const {
    localStream, peers, interpreterIds,
    isMuted, isVideoOff, isSharingScreen,
    messages, error, isConnected,
    presenterId,
    // Interpretation state (from useWebRTC now)
    channels, adminId, isAdmin, adminTokens,
    createChannel, deleteChannel,
    // Devices
    cameras, microphones, speakers,
    activeCameraId, activeMicId, activeSpeakerId,
    switchCamera, switchMicrophone, switchSpeaker,
    toggleMute, toggleVideo,
    startPresentation, stopPresentation,
    sendMessage, leaveRoom, endRoomForAll,
    mySocketId, socketRef,
    joinError, submitRoomPassword, roomEnded, request, background, changeBackground,
  } = useWebRTC(roomId, userName, null, initialMedia);

  const [layout, setLayout] = useState('gallery');
  const [pinned, setPinned] = useState(null);
  const [readMessageId, setReadMessageId] = useState(null);
  const features = useMeetingFeatures({ socketRef, isConnected, request, isMuted, roomId });
  const recordingParticipants = useMemo(() => [
    { id: 'local', stream: localStream, label: userName, isLocal: true, isPresenting: isSharingScreen },
    ...Object.entries(peers).filter(([id]) => !interpreterIds.has(id)).map(([id, p]) => ({ id, stream: p.stream, label: p.userName || 'Guest', isLocal: false, isPresenting: id === presenterId })),
  ], [localStream, userName, peers, interpreterIds, isSharingScreen, presenterId]);
  const { isRecording, isPaused, durationLabel, recordingError, startRecording, pauseRecording, stopRecording } = useRecorder(recordingParticipants, roomEnded);
  React.useEffect(() => {
    if (features.move) { stopRecording(); leaveRoom(); navigate(`/room/${features.move.roomId}?name=${encodeURIComponent(userName)}`); }
  }, [features.move, leaveRoom, navigate, stopRecording, userName]);
  const unread = showChat ? 0 : messages.slice(readMessageId ? Math.max(0, messages.findIndex(m => m.id === readMessageId) + 1) : 0).filter(m => m.from !== mySocketId).length;
  function closeChat() { setReadMessageId(messages.at(-1)?.id || null); setShowChat(false); }

  // Audio routing only — no socket needed
  const { selectedChannelId, selectChannel } = useInterpretation(channels, peers);

  // Filter interpreters out of the visible grid
  const peerList = useMemo(() =>
    Object.entries(peers).filter(([id]) => !interpreterIds.has(id)),
  [peers, interpreterIds]);

  const totalParticipants = 1 + peerList.length;

  function handleLeave() {
    // A participant leaving affects nobody else, so it needs no
    // confirmation. The host has a second option that does, so they are
    // asked which one they meant.
    if (isAdmin && peerList.length > 0) {
      setShowLeavePrompt(true);
      return;
    }
    if (isRecording) stopRecording();
    leaveRoom();
    navigate("/");
  }

  function handleJustLeave() {
    setShowLeavePrompt(false);
    if (isRecording) stopRecording();
    leaveRoom();
    navigate("/");
  }

  function handleEndForEveryone() {
    setShowLeavePrompt(false);
    if (isRecording) stopRecording();
    // No teardown or navigation here: the server answers with
    // `room-ended`, which every client including this one acts on, so the
    // host leaves by the same path as everyone else.
    endRoomForAll();
  }

  function handleToggleRecord() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  if (roomEnded) return (
    <div style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",background:"var(--bg)",gap:"16px",padding:"24px",textAlign:"center" }}>
      <PhoneOff size={48} style={{ color:"var(--text-2)" }} />
      <h2 style={{ color:"var(--text-1)" }}>
        {isAdmin ? "You ended this meeting" : "The host ended this meeting"}
      </h2>
      <p style={{ color:"var(--text-2)",maxWidth:"400px" }}>
        Room <strong style={{ color:"var(--text-1)",letterSpacing:"0.1em" }}>{roomId}</strong> is
        closed and its code no longer works. Starting a new meeting gives you a new code.
      </p>
      <button className="icon-btn" onClick={() => navigate("/dashboard")} style={{ marginTop:"8px",padding:"12px 28px",
        background:"var(--accent)",border:"none",
        borderRadius:"8px",color:"var(--on-accent)",cursor:"pointer",fontFamily:"inherit",
        fontSize:"0.95rem",fontWeight:600,minHeight:"44px" }}>
        <Home size={16} /> Back to dashboard
      </button>
    </div>
  );

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

  if (joinError && joinError.code !== "password-required") return (
    <div style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 32, textAlign: "center", background: "var(--bg)", color: "var(--text-1)" }}>
      <h2>{joinError.code === "pending" ? "Waiting for approval" : "Unable to join"}</h2>
      <p>{joinError.message}</p>
      <button className="icon-btn" onClick={() => navigate("/dashboard")}><Home size={16} /> Back to dashboard</button>
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
            color:"var(--text-1)" }}>{features.state.title || "Oguz Meeting"}</span>
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

          <span style={{ color:"var(--text-2)",fontSize:"clamp(0.7rem, 1.5vw, 0.82rem)",padding:"clamp(2px, 1vw, 4px) clamp(6px, 1vw, 10px)",
            background:"var(--surface-2)",borderRadius:"6px",
            border:"1px solid var(--border)",whiteSpace:"nowrap" }}>{roomId}</span>
          <ThemeToggle inline />
        </div>
      </div>

      <MeetingTools features={features} isAdmin={isAdmin} myId={mySocketId} layout={layout} setLayout={setLayout}
        pinned={pinned} setPinned={setPinned} background={background} changeBackground={changeBackground}
        unread={unread} openChat={() => setShowChat(true)} />
      {recordingError && <div className="meeting-notice" role="alert">{recordingError}</div>}
      <MeetingStage localStream={localStream} peers={peers} interpreterIds={interpreterIds} myId={mySocketId}
        name={userName} muted={isMuted} videoOff={isVideoOff} speakerId={activeSpeakerId} adminId={adminId}
        layout={layout} pinned={pinned} setPinned={setPinned} spotlightId={features.state.spotlightId}
        presenterId={presenterId} isSharingScreen={isSharingScreen} stopPresentation={stopPresentation} />
      {showChat && <MeetingChat messages={messages} onSend={sendMessage} myId={mySocketId} participants={features.state.participants} onClose={closeChat} />}

      <RecordingIndicator isRecording={isRecording} isPaused={isPaused}
        durationLabel={durationLabel} onPause={pauseRecording} onStop={stopRecording} />

      <Controls
        isMuted={isMuted} isVideoOff={isVideoOff} isSharingScreen={isSharingScreen}
        showChat={showChat} isRecording={isRecording}
        isInterpreterActive={!!selectedChannelId}
        onToggleMute={toggleMute} onToggleVideo={toggleVideo}
        onToggleScreen={() => isSharingScreen ? stopPresentation() : !features.state.allowScreenShare && !isAdmin ? features.setNotice("Screen sharing is restricted to the host.") : setShowSharePicker(true)}
        onToggleChat={() => showChat ? closeChat() : setShowChat(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleRecord={handleToggleRecord}
        onOpenInterpretation={() => setShowInterpretation(true)}
        onLeave={handleLeave}
        participantCount={totalParticipants} roomId={roomId}
        onOpenInvite={() => setShowInvite(true)}
      />

      {showLeavePrompt && (
        <LeavePrompt
          participantCount={peerList.length}
          onEndForEveryone={handleEndForEveryone}
          onJustLeave={handleJustLeave}
          onCancel={() => setShowLeavePrompt(false)}
        />
      )}

      {showInvite && (
        <InvitePanel
          roomId={roomId}
          password={searchParams.get("pwd") || ""}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showSharePicker && (
        <SharePicker
          onShare={s => { setShowSharePicker(false); startPresentation(s).catch(e => features.setNotice(e.message)); }}
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
