import { useEffect, useMemo, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { Pin, PinOff, MonitorOff } from './icons';

export default function MeetingStage({ localStream, peers, interpreterIds, myId, name, muted, videoOff,
  speakerId, adminId, layout, pinned, setPinned, spotlightId, presenterId, isSharingScreen, stopPresentation }) {
  const people = useMemo(() => [
    { id: myId || 'local', stream: localStream, userName: name, isMuted: muted, isVideoOff: videoOff && !isSharingScreen, local: true },
    ...Object.entries(peers).filter(([id]) => !interpreterIds.has(id)).map(([id, p]) => ({ id, ...p })),
  ], [myId, localStream, name, muted, videoOff, isSharingScreen, peers, interpreterIds]);
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    const context = new AudioContext();
    const nodes = people.filter(p => p.stream?.getAudioTracks().length).map(p => {
      const source = context.createMediaStreamSource(p.stream); const analyser = context.createAnalyser();
      analyser.fftSize = 256; source.connect(analyser);
      return { id: p.id, source, analyser, data: new Uint8Array(256) };
    });
    let lastSwitch = 0;
    const timer = setInterval(() => {
      let best = null; let peak = 0.035;
      for (const node of nodes) {
        node.analyser.getByteTimeDomainData(node.data);
        const level = Math.sqrt(node.data.reduce((sum, x) => sum + ((x - 128) / 128) ** 2, 0) / node.data.length);
        if (level > peak) { peak = level; best = node.id; }
      }
      if (best && Date.now() - lastSwitch > 1500) { setActiveId(best); lastSwitch = Date.now(); }
    }, 250);
    context.resume().catch(() => {});
    return () => { clearInterval(timer); nodes.forEach(n => n.source.disconnect()); context.close(); };
  }, [people]);
  const featured = people.find(p => p.id === presenterId) || people.find(p => p.id === spotlightId) || people.find(p => p.id === pinned)
    || (layout === 'speaker' ? people.find(p => p.id === activeId) || people[0] : null);
  function tile(p, large = false) {
    return <div key={p.id} className={`tile-wrap ${p.id === activeId ? 'speaking' : ''} ${large ? 'main-tile' : ''}`}>
      <VideoPlayer stream={p.stream} peerId={p.local ? undefined : p.id} label={p.userName || 'Participant'}
        isMuted={p.isMuted} isVideoOff={p.id === presenterId ? false : p.isVideoOff} isLocal={!!p.local} isAdmin={p.id === adminId}
        speakerId={speakerId} presenting={p.id === presenterId} style={{ width:'100%',height:large ? '100%' : undefined,aspectRatio:'16/9' }} />
      <div className="tile-actions"><button className="icon-btn" onClick={() => setPinned(pinned === p.id ? null : p.id)}>{pinned === p.id ? <><PinOff size={14} /> Unpin</> : <><Pin size={14} /> Pin</>}</button>
        {p.id === spotlightId && <span style={{background:'#111b',color:'white',padding:5}}>Spotlight</span>}
        {p.local && isSharingScreen && <button className="icon-btn" onClick={stopPresentation}><MonitorOff size={14} /> Stop sharing</button>}</div>
    </div>;
  }
  return featured ? <div className="stage-speaker">{tile(featured, true)}<div className="stage-thumbnails">{people.filter(p => p.id !== featured.id).map(p => tile(p))}</div></div>
    : <div className="stage-grid">{people.map(p => tile(p))}</div>;
}
