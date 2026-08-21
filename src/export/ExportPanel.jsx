import { useCallback, useRef, useState } from 'react';
import { LiveCanvasRecorder, renderOffline, downloadBlob } from './CanvasRecorder';

/**
 * ExportPanel
 * ------------------------------------------------------------------
 * UI for both export strategies. "Quick Record" starts/stops a live
 * MediaRecorder capture in real time (WebM). "Render MP4" drives the
 * deterministic offline pipeline via ffmpeg.wasm — see CanvasRecorder.js
 * for why these are separate code paths.
 */
export default function ExportPanel({ audioApi, canvasEl, audioFile }) {
  const [isRecording, setIsRecording] = useState(false);
  const [renderProgress, setRenderProgress] = useState(null); // { phase, frame, totalFrames }
  const liveRecorderRef = useRef(null);

  const startLiveRecording = useCallback(() => {
    if (!canvasEl || !audioApi?.engine?.context) return;
    liveRecorderRef.current = new LiveCanvasRecorder({
      canvas: canvasEl,
      audioContext: audioApi.engine.context,
      audioSourceNode: audioApi.engine.gainNode
    });
    audioApi.seek(0);
    audioApi.play();
    liveRecorderRef.current.start(30);
    setIsRecording(true);
  }, [audioApi, canvasEl]);

  const stopLiveRecording = useCallback(async () => {
    audioApi.pause();
    const blob = await liveRecorderRef.current?.stop();
    setIsRecording(false);
    if (blob) downloadBlob(blob, 'visualizer-export.webm');
  }, [audioApi]);

  const runOfflineRender = useCallback(async () => {
    if (!canvasEl || !audioFile || !audioApi?.duration) return;
    setRenderProgress({ phase: 'starting', frame: 0, totalFrames: 1 });

    try {
      const blob = await renderOffline({
        canvas: canvasEl,
        duration: audioApi.duration,
        fps: 30,
        audioFile,
        onProgress: setRenderProgress,
        // Advances audio + (if wired) a manual scene clock to `t`, then
        // waits a frame so React-Three-Fiber has drawn before capture.
        renderFrame: async (t) => {
          audioApi.seek(t);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
      });
      downloadBlob(blob, 'visualizer-export.mp4');
    } finally {
      setRenderProgress(null);
    }
  }, [audioApi, audioFile, canvasEl]);

  return (
    <div className="export-panel">
      <div className="export-panel__row">
        <button
          className="btn"
          onClick={isRecording ? stopLiveRecording : startLiveRecording}
          disabled={!!renderProgress}
        >
          {isRecording ? 'Stop & Save (WebM)' : 'Quick Record (WebM)'}
        </button>

        <button className="btn btn--accent" onClick={runOfflineRender} disabled={isRecording || !!renderProgress}>
          Render MP4 (offline, exact sync)
        </button>
      </div>

      {renderProgress && (
        <div className="export-panel__progress">
          <div className="export-panel__progress-label">
            {renderProgress.phase === 'rendering' &&
              `Rendering frame ${renderProgress.frame}/${renderProgress.totalFrames}`}
            {renderProgress.phase === 'encoding' && 'Encoding MP4…'}
            {renderProgress.phase === 'starting' && 'Preparing ffmpeg.wasm…'}
            {renderProgress.phase === 'done' && 'Done!'}
          </div>
          <div className="export-panel__progress-bar">
            <div
              className="export-panel__progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  (renderProgress.frame / Math.max(1, renderProgress.totalFrames)) * 100
                )}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
