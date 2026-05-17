// ============================================================
// useInterpretation.js — audio routing + channel selection only
// All socket events are now handled inside useWebRTC
// ============================================================
import { useState, useCallback, useEffect, useRef } from "react";

const DIM  = 0.15;
const FULL = 1.0;

export function useInterpretation(channels, peers) {
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const channelsRef = useRef(channels);
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  // Apply volume routing to all peer video elements via data-peer-id
  const applyRouting = useCallback((channelId) => {
    const ch = channelsRef.current.find(c => c.id === channelId);
    const interpreterId = ch?.interpreterSocketId || null;
    document.querySelectorAll("[data-peer-id]").forEach(el => {
      const pid = el.getAttribute("data-peer-id");
      el.volume = (!channelId || pid === interpreterId) ? FULL : DIM;
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
