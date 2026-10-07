// A peer can appear in both the presentation and the sidebar. Combine their
// views before changing the one consumer, so a hidden thumbnail cannot pause
// a visible presentation. Audio never enters this controller.
export function createVideoPreferences({ request, onError = () => {} }) {
  const views = new Map();
  const consumers = new Map();
  let hidden = false;
  let recording = false;

  function preference(consumer) {
    const peerViews = views.get(consumer.appData.socketId);
    const visible = peerViews
      ? [...peerViews.values()].filter(view => view.visible)
      : [{ spatialLayer: 1, priority: 1 }];
    const screen = consumer.appData.source === "screen";
    return {
      paused: !recording && (hidden || visible.length === 0),
      spatialLayer: screen ? 2 : Math.max(recording ? 1 : 0, ...visible.map(view => view.spatialLayer)),
      priority: screen ? 3 : Math.max(1, ...visible.map(view => view.priority)),
    };
  }

  function update(state) {
    const desired = preference(state.consumer);
    state.desired = { ...desired, key: JSON.stringify(desired) };
    if (state.running) return state.running;
    if (state.lastKey === state.desired.key) return Promise.resolve();

    state.running = (async () => {
      while (consumers.get(state.consumer.id) === state && !state.consumer.closed) {
        const next = state.desired;
        if (next.key === state.lastKey) break;
        try {
          await request("sfu-set-consumer-preferences", {
            consumerId: state.consumer.id,
            paused: next.paused,
            spatialLayer: next.spatialLayer,
            priority: next.priority,
          });
          if (consumers.get(state.consumer.id) !== state || state.consumer.closed) break;
          if (next.paused) state.consumer.pause();
          else state.consumer.resume();
          state.lastKey = next.key;
        } catch (error) {
          if (consumers.get(state.consumer.id) === state && !state.consumer.closed) onError(error);
          // A newer view update still needs to be applied after a failed request.
          if (next === state.desired) break;
        }
      }
    })().finally(() => { state.running = null; });
    return state.running;
  }

  function refresh(peerId) {
    return Promise.all([...consumers.values()]
      .filter(state => !peerId || state.consumer.appData.socketId === peerId)
      .map(update));
  }

  return {
    addConsumer(consumer) {
      if (consumer.kind !== "video") return Promise.resolve();
      const state = { consumer, lastKey: null, running: null };
      consumers.set(consumer.id, state);
      return update(state);
    },
    removeConsumer(consumerId) { consumers.delete(consumerId); },
    setView(peerId, viewId, view) {
      if (!peerId) return Promise.resolve();
      let peerViews = views.get(peerId);
      if (!peerViews) { peerViews = new Map(); views.set(peerId, peerViews); }
      if (view) peerViews.set(viewId, view);
      else peerViews.delete(viewId);
      return refresh(peerId);
    },
    setHidden(value) { hidden = value; return refresh(); },
    setRecording(value) { recording = value; return refresh(); },
    removePeer(peerId) {
      views.delete(peerId);
      for (const [id, state] of consumers) {
        if (state.consumer.appData.socketId === peerId) consumers.delete(id);
      }
    },
    reset() { consumers.clear(); views.clear(); },
  };
}
