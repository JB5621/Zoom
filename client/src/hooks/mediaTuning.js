// ============================================================
// mediaTuning.js — capture and encoder settings.
//
// Under the old full mesh, a client encoded and uploaded one copy of
// its camera per peer, so the per-peer budget had to shrink as the room
// filled: the ladder here used to be a division of one upstream link
// between everyone you were sending to.
//
// With an SFU that division is gone. Each client uploads once, to the
// server, no matter how many people are listening, so the budget is now
// fixed. What replaces the ladder is simulcast: send the same camera at
// three sizes at once and let the server pick which one each viewer
// gets, so a phone on a train and a laptop on fibre can watch the same
// speaker without either dictating quality to the other.
// ============================================================

// Capture once at 720p30 and let simulcast scale down from there.
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
 * Three simulcast layers for a camera: roughly 180p, 360p and 720p.
 *
 * Order matters — mediasoup reads these lowest-first, and the rids are
 * what the server names each layer by when it decides which one to
 * forward to a given viewer.
 */
export const CAMERA_ENCODINGS = [
  { rid: "r0", maxBitrate: 150_000, scaleResolutionDownBy: 4, scalabilityMode: "S1T3" },
  { rid: "r1", maxBitrate: 500_000, scaleResolutionDownBy: 2, scalabilityMode: "S1T3" },
  { rid: "r2", maxBitrate: 1_500_000, scaleResolutionDownBy: 1, scalabilityMode: "S1T3" },
];

/**
 * Screen share is a single high-bitrate layer rather than simulcast.
 *
 * Shrinking a slide to 180p makes it unreadable, which is worse than
 * useless, so there is nothing sensible to degrade to — the whole point
 * of the frame is text that has to stay legible. Frame rate is what
 * gives instead.
 */
export const SCREEN_ENCODINGS = [
  { maxBitrate: 2_500_000, maxFramerate: 15, scalabilityMode: "S1T3" },
];

/** Opus settings worth asking for explicitly on a conference mic. */
export const AUDIO_CODEC_OPTIONS = {
  opusStereo: false,
  opusDtx: true,          // stop sending during silence
  opusFec: true,          // recover isolated lost packets
  opusMaxPlaybackRate: 48000,
};

export const CAMERA_CODEC_OPTIONS = {
  videoGoogleStartBitrate: 1000,
};

/**
 * contentHint tells the encoder what the pixels are, which changes how
 * it spends bits. Without it the encoder has to guess from the signal.
 */
export function setContentHints(stream, { screenShare = false } = {}) {
  stream?.getVideoTracks().forEach((t) => {
    if ("contentHint" in t) t.contentHint = screenShare ? "detail" : "motion";
  });
  stream?.getAudioTracks().forEach((t) => {
    if ("contentHint" in t) t.contentHint = "speech";
  });
}
