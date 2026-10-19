import { useEffect, useRef, useState } from 'react';
import './meeting.css';
import { Mic, MicOff, Video, VideoOff, Volume2 } from './icons';

export default function PreJoin({ name, onJoin }) {
  const video = useRef(null);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [camera, setCamera] = useState('');
  const [mic, setMic] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    (async () => {
      try {
        if (!navigator.mediaDevices) throw Error('Camera and microphone access requires HTTPS or localhost.');
        let media;
        try {
          media = await navigator.mediaDevices.getUserMedia({ video: camera ? { deviceId: { exact: camera } } : true,
            audio: mic ? { deviceId: { exact: mic }, echoCancellation: true } : { echoCancellation: true } });
        } catch {
          media = await navigator.mediaDevices.getUserMedia({ audio: mic ? { deviceId: { exact: mic } } : true });
        }
        if (cancelled) { media.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = media; setStream(media);
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(list);
      } catch (e) { if (!cancelled) setError(`${e.message} You can still join without devices.`); }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [camera, mic]);
  useEffect(() => {
    stream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    stream?.getVideoTracks().forEach(t => { t.enabled = !videoOff; });
    if (video.current) video.current.srcObject = stream;
  }, [stream, muted, videoOff]);
  useEffect(() => {
    if (!stream?.getAudioTracks().length) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      setLevel(Math.min(100, Math.sqrt(data.reduce((sum, x) => sum + ((x - 128) / 128) ** 2, 0) / data.length) * 400));
    }, 100);
    return () => { clearInterval(timer); source.disconnect(); context.close(); };
  }, [stream]);
  async function testSpeaker() {
    const ctx = new AudioContext();
    try {
      if (speaker && ctx.setSinkId) await ctx.setSinkId(speaker);
      await ctx.resume();
      const tone = ctx.createOscillator(); const gain = ctx.createGain(); gain.gain.value = 0.12;
      tone.frequency.value = 440; tone.connect(gain).connect(ctx.destination); tone.start(); tone.stop(ctx.currentTime + 0.5);
      tone.onended = () => ctx.close();
    } catch (e) { setError(e.message); ctx.close(); }
  }
  function join() {
    const media = streamRef.current || new MediaStream();
    media.getTracks().forEach(t => t.stop());
    onJoin({ camera, mic, hasAudio: !!media.getAudioTracks().length, hasVideo: !!media.getVideoTracks().length, muted: muted || !media.getAudioTracks().length, videoOff: videoOff || !media.getVideoTracks().length, speaker });
  }
  return <main className="prejoin"><section className="meeting-card">
    <h1>Ready to join, {name}?</h1><p>Check your devices before entering the meeting.</p>
    <video ref={video} autoPlay muted playsInline className="preview" />
    <div className="meeting-actions"><button className="icon-btn" onClick={() => setMuted(v => !v)} aria-pressed={muted}>{muted ? <><MicOff size={16} /> Turn microphone on</> : <><Mic size={16} /> Mute microphone</>}</button>
      <button className="icon-btn" onClick={() => setVideoOff(v => !v)} aria-pressed={videoOff}>{videoOff ? <><VideoOff size={16} /> Turn camera on</> : <><Video size={16} /> Turn camera off</>}</button></div>
    <label>Microphone level <meter min="0" max="100" value={level} /></label>
    {[['videoinput', 'Camera', camera, setCamera], ['audioinput', 'Microphone', mic, setMic], ['audiooutput', 'Speaker', speaker, setSpeaker]].map(([kind, label, value, change]) =>
      <label key={kind}>{label}<select value={value} onChange={e => { if (kind !== "audiooutput") setReady(false); setError(''); change(e.target.value); }}><option value="">System default</option>{devices.filter(d => d.kind === kind).map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}</select></label>)}
    <button className="icon-btn" onClick={testSpeaker}><Volume2 size={16} /> Play test sound</button>
    {error && <p role="alert">{error}</p>}
    <button className="primary icon-btn" disabled={!ready} onClick={join}>{ready ? <><Video size={16} /> Join meeting</> : 'Checking devices…'}</button>
  </section></main>;
}
