// ============================================================
// mediaTuning.js — encoder and capture settings.
//
// Nothing in this app previously configured the encoder, so Chrome fell
// back to a conservative default: measured output was 960x540@20fps with
// qualityLimitationReason "bandwidth" even over loopback. The settings
// here give the encoder an explicit budget and tell it which axis to
// sacrifice when it cannot meet it.
//
// This is a full mesh: every participant sends one copy of their video to
// every other participant, so upstream cost grows with the call. The
// budget below is therefore per-peer and shrinks as the call grows.
// ============================================================

// Capture once at 720p30 and let the encoder scale per-peer from there.
// `ideal` rather than `exact` so a webcam that cannot do this still opens.
export const CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

/**
 * Per-peer video budget, by how many people you are sending to.
 * Total upstream is roughly bitrate x peers, so the ladder keeps the sum
 * inside what a typical connection can actually sustain.
 */
function videoBudget(peerCount) {
  if (peerCount <= 1) return { maxBitrate: 1_800_000, scale: 1 };   // 720p
  if (peerCount <= 3) return { maxBitrate: 1_000_000, scale: 1.5 }; // ~480p
  if (peerCount <= 6) return { maxBitrate: 600_000, scale: 2 };     // 360p
  return { maxBitrate: 350_000, scale: 3 };                         // ~240p
}

/**
 * Apply send parameters to one peer connection.
 *
 * degradationPreference is the setting that decides how a call "feels"
 * under pressure: maintain-framerate keeps motion smooth and lets the
 * picture soften, which is right for faces. Screen share is the opposite
 * — text has to stay legible, so resolution is held instead.
 */
export async function tuneSender(pc, peerCount, { screenShare = false } = {}) {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (!sender) return;

  const params = sender.getParameters();
  // getParameters() can return no encodings before the first negotiation;
  // setting parameters on an empty list throws.
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }

  const { maxBitrate, scale } = videoBudget(peerCount);
  params.degradationPreference = screenShare ? "maintain-resolution" : "maintain-framerate";
  params.encodings[0].maxBitrate = screenShare ? 2_500_000 : maxBitrate;
  params.encodings[0].maxFramerate = screenShare ? 15 : 30;
  params.encodings[0].scaleResolutionDownBy = screenShare ? 1 : scale;
  params.encodings[0].networkPriority = "high";
  params.encodings[0].priority = "high";

  try {
    await sender.setParameters(params);
  } catch (err) {
    // Older browsers reject individual fields; a failure here only means
    // we fall back to the previous behaviour, so it must not break the call.
    console.warn("[mediaTuning] setParameters rejected:", err.message);
  }
}

/** Re-apply the budget to every peer, e.g. after someone joins or leaves. */
export function tuneAllSenders(peers, { screenShare = false } = {}) {
  const list = Object.values(peers);
  list.forEach((pc) => tuneSender(pc, list.length, { screenShare }));
}

/**
 * contentHint tells the encoder what the pixels are, which changes how it
 * spends bits. Without it the encoder has to guess from the signal.
 */
export function setContentHints(stream, { screenShare = false } = {}) {
  stream?.getVideoTracks().forEach((t) => {
    if ("contentHint" in t) t.contentHint = screenShare ? "detail" : "motion";
  });
  stream?.getAudioTracks().forEach((t) => {
    if ("contentHint" in t) t.contentHint = "speech";
  });
}
