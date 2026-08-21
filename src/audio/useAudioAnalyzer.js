import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AudioEngine from './AudioEngine';

/**
 * useAudioAnalyzer
 * ------------------------------------------------------------------
 * React binding for AudioEngine. Exposes transport controls (load,
 * play, pause, seek) plus a `metricsRef` that is updated every
 * animation frame WITHOUT causing a React re-render — the R3F scene
 * reads `metricsRef.current` directly inside useFrame for zero-latency,
 * 60fps-safe audio reactivity. Playback time/duration are separately
 * mirrored into state (throttled) so the UI timeline can re-render.
 */
export default function useAudioAnalyzer() {
  const engineRef = useRef(null);
  const metricsRef = useRef({ bass: 0, mid: 0, treble: 0, energy: 0, beat: false, time: 0 });
  const rafRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fileName, setFileName] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error

  const engine = useMemo(() => {
    engineRef.current = new AudioEngine();
    return engineRef.current;
  }, []);

  useEffect(() => () => engine.dispose(), [engine]);

  // Single rAF loop drives both the analyser sampling and the (throttled)
  // React state sync so the timeline scrubber stays in sync.
  useEffect(() => {
    let lastUiSync = 0;
    const tick = (t) => {
      const m = engine.getMetrics();
      if (m) {
        metricsRef.current = m;
        if (t - lastUiSync > 100) {
          setCurrentTime(m.time);
          lastUiSync = t;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine]);

  const loadFile = useCallback(
    async (file) => {
      setStatus('loading');
      try {
        const buffer = await engine.loadFile(file);
        setDuration(buffer.duration);
        setFileName(file.name);
        setStatus('ready');
      } catch (err) {
        console.error('Failed to decode audio file:', err);
        setStatus('error');
      }
    },
    [engine]
  );

  const play = useCallback(() => {
    engine.play();
    setIsPlaying(true);
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
    setIsPlaying(false);
  }, [engine]);

  const toggle = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, play, pause]);

  const seek = useCallback(
    (seconds) => {
      engine.seek(seconds);
      setCurrentTime(seconds);
    },
    [engine]
  );

  const setSensitivity = useCallback((partial) => engine.setSensitivity(partial), [engine]);

  return {
    engine, // raw engine instance (needed by the export/recording module)
    metricsRef, // live per-frame metrics for the R3F scene
    loadFile,
    play,
    pause,
    toggle,
    seek,
    setSensitivity,
    isPlaying,
    duration,
    currentTime,
    fileName,
    status
  };
}
