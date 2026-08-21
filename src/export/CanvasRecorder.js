/**
 * CanvasRecorder
 * ------------------------------------------------------------------
 * Two export strategies, exposed through one API:
 *
 * 1. `recordLive()` — real-time capture via canvas.captureStream() +
 *    MediaRecorder, muxed with the live AudioContext output through a
 *    MediaStreamDestination. Fast, simple, runs at whatever frame rate
 *    the browser actually renders — good for quick shares/previews.
 *    Output: WebM (VP9/Opus) directly, no extra dependencies.
 *
 * 2. `renderOffline()` — deterministic, frame-by-frame export. Steps
 *    audio+scene time forward by a fixed 1/fps increment, waits for
 *    each frame to render, grabs a PNG snapshot of the canvas, then
 *    hands the full PNG sequence + the original audio track to
 *    ffmpeg.wasm to mux an MP4 at a guaranteed frame rate — including
 *    on machines too slow to render in real time. This is the path
 *    that guarantees perfect audio/video sync regardless of render
 *    performance, at the cost of export taking longer than playback.
 *
 * Both strategies are UI-agnostic: pass callbacks/refs in, get a Blob
 * (or download) out. See ExportPanel.jsx for the React wiring.
 */

export class LiveCanvasRecorder {
  constructor({ canvas, audioContext, audioSourceNode, mimeType, videoBitsPerSecond }) {
    this.canvas = canvas;
    this.audioContext = audioContext;
    this.audioSourceNode = audioSourceNode; // e.g. engine.gainNode
    this.mimeType = mimeType || pickSupportedMimeType();
    this.videoBitsPerSecond = videoBitsPerSecond || 12_000_000;
    this.recorder = null;
    this.chunks = [];
  }

  start(fps = 30) {
    const canvasStream = this.canvas.captureStream(fps);

    // Route the analyser/gain node's audio into a MediaStreamDestination
    // so it can be combined with the canvas's video track.
    const dest = this.audioContext.createMediaStreamDestination();
    this.audioSourceNode.connect(dest);

    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    this.recorder = new MediaRecorder(combined, {
      mimeType: this.mimeType,
      videoBitsPerSecond: this.videoBitsPerSecond
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250); // gather data every 250ms
  }

  /** Resolves with the final Blob once the recorder has flushed. */
  stop() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null);
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        resolve(blob);
      };
      this.recorder.stop();
    });
  }
}

function pickSupportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}

/**
 * Offline, deterministic frame-by-frame render using ffmpeg.wasm.
 *
 * `renderFrame(timeSeconds)` is caller-supplied: it must advance the
 * AudioEngine + R3F scene to that exact timestamp and resolve once the
 * canvas has drawn the corresponding frame (e.g. via a manual clock
 * override + requestAnimationFrame or gl.render()).
 */
export async function renderOffline({
  canvas,
  duration,
  fps = 30,
  renderFrame,
  audioFile,
  onProgress,
  outputName = 'export.mp4'
}) {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
  });

  const totalFrames = Math.ceil(duration * fps);
  const digits = String(totalFrames).length;

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    await renderFrame(t); // caller advances engine + scene + draws to `canvas`

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    const name = `frame_${String(frame).padStart(digits, '0')}.png`;
    await ffmpeg.writeFile(name, buf);

    onProgress?.({ phase: 'rendering', frame, totalFrames });
  }

  await ffmpeg.writeFile('audio.input', await fetchFile(audioFile));

  onProgress?.({ phase: 'encoding', frame: totalFrames, totalFrames });

  // -framerate: input image sequence rate. -c:v libx264 + yuv420p for
  // maximum player compatibility. -shortest trims to the shorter of the
  // (exact) video length and the source audio length.
  await ffmpeg.exec([
    '-framerate',
    String(fps),
    '-i',
    `frame_%0${digits}d.png`,
    '-i',
    'audio.input',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  onProgress?.({ phase: 'done', frame: totalFrames, totalFrames });

  return new Blob([data.buffer], { type: 'video/mp4' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
