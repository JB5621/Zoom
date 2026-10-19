import { useCallback, useEffect, useRef, useState } from 'react';

export function useMeetingFeatures({ socketRef, isConnected, request, isMuted, roomId }) {
  const [state, setState] = useState({ participants: [], breakouts: [], locked: false, allowScreenShare: true });
  const [notice, setNotice] = useState('');
  const [reactions, setReactions] = useState([]);
  const [captions, setCaptions] = useState([]);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [transcribe, setTranscribe] = useState(false);
  const [language, setLanguage] = useState('en-US');
  const [move, setMove] = useState(null);
  const timers = useRef(new Set());
  const act = useCallback(async (event, payload) => {
    try { await request(event, payload); setNotice(''); return true; }
    catch (error) { setNotice(error.message); return false; }
  }, [request]);
  useEffect(() => {
    const activeTimers = timers.current;
    const socket = socketRef.current;
    if (!socket) return;
    const reaction = value => {
      setReactions(list => [...list.slice(-3), value]);
      const timer = setTimeout(() => { setReactions(list => list.filter(x => x.id !== value.id)); activeTimers.delete(timer); }, 4500);
      activeTimers.add(timer);
    };
    const caption = value => {
      setCaptions(list => [...list.slice(-1), value]);
      const timer = setTimeout(() => { setCaptions(list => list.filter(x => x.id !== value.id)); activeTimers.delete(timer); }, 12000);
      activeTimers.add(timer);
    };
    const moveTo = data => setMove(data);
    socket.on('meeting-state', setState); socket.on('reaction', reaction);
    socket.on('caption', caption); socket.on('breakout-move', moveTo);
    // Fetch a snapshot if the initial join events beat React's effect.
    request('meeting-state-get').then(value => value.state && setState(value.state)).catch(() => {});
    return () => {
      socket.off('meeting-state', setState); socket.off('reaction', reaction);
      socket.off('caption', caption); socket.off('breakout-move', moveTo);
      for (const timer of activeTimers) clearTimeout(timer);
      activeTimers.clear();
    };
  }, [socketRef, isConnected, roomId, request]);
  useEffect(() => {
    if (!transcribe || isMuted || !isConnected) return;
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return;
    let active = true; let timer;
    const recognition = new Speech(); recognition.continuous = true; recognition.interimResults = false; recognition.lang = language;
    recognition.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) request('caption', { text: event.results[i][0].transcript }).catch(() => {});
      }
    };
    recognition.onerror = event => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      active = false; setTranscribe(false);
      setNotice(`Live transcription unavailable: ${event.error}. You can still view captions shared by others.`);
    };
    recognition.onend = () => { if (active) timer = setTimeout(() => { try { recognition.start(); } catch { /* Already running. */ } }, 500); };
    try { recognition.start(); } catch (error) { queueMicrotask(() => setNotice(error.message)); }
    return () => { active = false; clearTimeout(timer); recognition.abort(); };
  }, [transcribe, isMuted, isConnected, language, request]);
  return { state, act, notice, setNotice, reactions, captions, captionsEnabled, setCaptionsEnabled,
    transcribe, setTranscribe, language, setLanguage, move,
    speechSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition) };
}
