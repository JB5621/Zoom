// ============================================================
// useInterpretation.js — audio routing + channel selection only
// All socket events are now handled inside useWebRTC
// ============================================================
import { useState, useCallback, useEffect, useRef } from "react";

const FULL = 1.0;

export function useInterpretation(channels, peers) {
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const channelsRef = useRef(channels);
  const peersRef = useRef(peers);
  useEffect(() => { channelsRef.current = channels; }, [channels]);
  useEffect(() => { peersRef.current = peers; }, [peers]);

  // Apply volume routing to all peer video/audio elements via data-peer-id
  const applyRouting = useCallback((channelId) => {
    const ch = channelsRef.current.find(c => c.id === channelId);
    const interpreterId = ch?.interpreterSocketId || null;
    const interpreterIds = new Set(
      channelsRef.current
        .map(c => c.interpreterSocketId)
        .filter(id => id)
    );
    
    document.querySelectorAll("[data-peer-id]").forEach(el => {
      const pid = el.getAttribute("data-peer-id");
      const isInterpreter = interpreterIds.has(pid);
      
      if (!channelId) {
        // Original Audio mode: play original participants, mute all interpreters
        el.volume = isInterpreter ? 0 : FULL;
      } else {
        // Interpreter mode: play selected interpreter only, mute everyone else
        el.volume = (pid === interpreterId) ? FULL : 0;
      }
    });
  }, []);

  // Re-apply whenever peers change (new people join)
  useEffect(() => { applyRouting(selectedChannelId); }, [selectedChannelId, applyRouting, peers]);

  const selectChannel = useCallback((channelId) => {
    setSelectedChannelId(channelId);
    applyRouting(channelId);
  }, [applyRouting]);

  return {
    selectedChannelId,
    activeChannel: channels.find(c => c.id === selectedChannelId) || null,
    selectChannel,
  };
}
