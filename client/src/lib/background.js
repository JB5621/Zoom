import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

// Matching pinned JS/WASM versions. Override these URLs for an offline deployment.
const WASM = import.meta.env.VITE_MEDIAPIPE_WASM_URL || 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const MODEL = import.meta.env.VITE_SEGMENTATION_MODEL_URL || 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';

export async function createBackground(rawTrack, mode, file) {
  if (!HTMLCanvasElement.prototype.captureStream) throw Error('Background effects are not supported in this browser.');
  if (file && file.size > 8 * 1024 * 1024) throw Error('Background images must be 8 MB or smaller.');
  let segmenter, bitmap, timer, stream;
  const video = document.createElement('video'); video.muted = true; video.playsInline = true;
  const stop = () => {
    clearTimeout(timer); stream?.getTracks().forEach(t => t.stop());
    video.pause(); video.srcObject = null; bitmap?.close(); segmenter?.close();
  };
  try {
    if (file) bitmap = await createImageBitmap(file, { resizeWidth: 1280 });
    const vision = await FilesetResolver.forVisionTasks(WASM);
    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
    });
    video.srcObject = new MediaStream([rawTrack]); await video.play();
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const foreground = document.createElement('canvas'); foreground.width = canvas.width; foreground.height = canvas.height;
    const maskCanvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d'); const fg = foreground.getContext('2d'); const maskCtx = maskCanvas.getContext('2d');
    let ended = false;
    function render() {
      if (ended || rawTrack.readyState === 'ended') return;
      try {
        const result = segmenter.segmentForVideo(video, performance.now());
        const mask = result.confidenceMasks[0]; const values = mask.getAsFloat32Array();
        maskCanvas.width = mask.width; maskCanvas.height = mask.height;
        const pixels = maskCtx.createImageData(mask.width, mask.height);
        for (let i = 0; i < values.length; i++) { pixels.data[i * 4] = 255; pixels.data[i * 4 + 1] = 255; pixels.data[i * 4 + 2] = 255; pixels.data[i * 4 + 3] = Math.round(values[i] * 255); }
        maskCtx.putImageData(pixels, 0, 0);
        result.confidenceMasks.forEach(m => m.close()); result.categoryMask?.close();
        fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, 640, 360); fg.drawImage(video, 0, 0, 640, 360);
        fg.globalCompositeOperation = 'destination-in'; fg.drawImage(maskCanvas, 0, 0, 640, 360);
        ctx.clearRect(0, 0, 640, 360);
        if (mode === 'blur') { ctx.filter = 'blur(14px)'; ctx.drawImage(video, -20, -20, 680, 400); ctx.filter = 'none'; }
        else if (bitmap) { ctx.drawImage(bitmap, 0, 0, 640, 360); }
        else { const gradient = ctx.createLinearGradient(0, 0, 640, 360); gradient.addColorStop(0, '#17304c'); gradient.addColorStop(1, '#7197aa'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 360); }
        ctx.drawImage(foreground, 0, 0);
      } catch {
        // Retain the last processed frame; never expose unprocessed surroundings.
      }
      timer = setTimeout(render, 1000 / 15);
    }
    render(); stream = canvas.captureStream(15);
    return { track: stream.getVideoTracks()[0], stop: () => { ended = true; stop(); } };
  } catch (error) { stop(); throw new Error(`Could not prepare background effects: ${error.message}`); }
}
