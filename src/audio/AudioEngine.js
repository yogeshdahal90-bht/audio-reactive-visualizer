/**
 * AudioEngine
 * ------------------------------------------------------------------
 * Thin wrapper around the Web Audio API that:
 *   1. Decodes an uploaded file (mp3/wav/etc.) into an AudioBuffer.
 *   2. Plays it through an AnalyserNode so we can pull FFT data every frame.
 *   3. Reduces the raw FFT bins into a small, UI/scene-friendly metrics
 *      object: { bass, mid, treble, energy, beat, waveform, spectrum }.
 *
 * This class is framework-agnostic on purpose — it can be driven from
 * React (see useAudioAnalyzer.js), a Node test harness, or the offline
 * export pipeline (CanvasRecorder.js) without modification.
 */

const FFT_SIZE = 2048; // -> 1024 frequency bins
const SMOOTHING = 0.8; // built-in analyser smoothing (temporal)

// Frequency bands, in Hz, used to bucket the spectrum into bass/mid/treble.
const BANDS = {
  bass: [20, 250],
  mid: [250, 4000],
  treble: [4000, 16000]
};

export default class AudioEngine {
  constructor({ fftSize = FFT_SIZE, smoothing = SMOOTHING } = {}) {
    this.context = null;
    this.analyser = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.buffer = null;
    this.fftSize = fftSize;
    this.smoothing = smoothing;

    this.startedAt = 0; // context.currentTime when playback started
    this.offset = 0; // seconds already played (for pause/scrub)
    this.isPlaying = false;

    // Reusable typed arrays to avoid GC pressure in the render loop.
    this._freqData = null;
    this._timeData = null;

    // Simple adaptive beat detector state.
    this._beatHistory = [];
    this._beatHistorySize = 43; // ~1s at 60fps of energy samples
    this._lastBeatAt = 0;

    // User-tunable reactivity sensitivity (see SensitivityPanel.jsx).
    this.sensitivity = {
      bass: 1.0,
      mid: 1.0,
      treble: 1.0,
      beatThreshold: 1.35 // multiple of rolling average energy to fire a beat
    };
  }

  async loadFile(file) {
    this._ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    this.buffer = await this.context.decodeAudioData(arrayBuffer);
    return this.buffer;
  }

  _ensureContext() {
    if (this.context) return;
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothing;

    this.gainNode = this.context.createGain();
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);

    this._freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this._timeData = new Uint8Array(this.analyser.fftSize);
  }

  /** Also exposes the analyser's destination for MediaRecorder muxing. */
  connectAdditionalDestination(node) {
    this.gainNode.connect(node);
  }

  play(offsetSeconds = this.offset) {
    if (!this.buffer) throw new Error('No audio loaded — call loadFile() first.');
    this._ensureContext();
    if (this.context.state === 'suspended') this.context.resume();

    this._stopSourceNode();

    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.connect(this.analyser);
    this.sourceNode.onended = () => {
      if (this.isPlaying && this.getCurrentTime() >= this.buffer.duration - 0.05) {
        this.isPlaying = false;
      }
    };

    this.sourceNode.start(0, offsetSeconds);
    this.startedAt = this.context.currentTime;
    this.offset = offsetSeconds;
    this.isPlaying = true;
  }

  pause() {
    if (!this.isPlaying) return;
    this.offset = this.getCurrentTime();
    this._stopSourceNode();
    this.isPlaying = false;
  }

  seek(seconds) {
    const wasPlaying = this.isPlaying;
    this.offset = Math.max(0, Math.min(seconds, this.duration));
    this._stopSourceNode();
    this.isPlaying = false;
    if (wasPlaying) this.play(this.offset);
  }

  _stopSourceNode() {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
      } catch (_) {
        /* already stopped */
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.offset;
    return this.offset + (this.context.currentTime - this.startedAt);
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  setSensitivity(partial) {
    this.sensitivity = { ...this.sensitivity, ...partial };
  }

  /**
   * Call once per animation frame. Returns a flat metrics object ready to
   * be mapped onto scene parameters by audioMapping.js.
   */
  getMetrics() {
    if (!this.analyser) return null;

    this.analyser.getByteFrequencyData(this._freqData);
    this.analyser.getByteTimeDomainData(this._timeData);

    const sampleRate = this.context.sampleRate;
    const binHz = sampleRate / this.analyser.fftSize;

    const bass = this._bandAverage(BANDS.bass, binHz) * this.sensitivity.bass;
    const mid = this._bandAverage(BANDS.mid, binHz) * this.sensitivity.mid;
    const treble = this._bandAverage(BANDS.treble, binHz) * this.sensitivity.treble;
    const energy = (bass + mid + treble) / 3;

    const beat = this._detectBeat(energy);

    return {
      time: this.getCurrentTime(),
      bass,
      mid,
      treble,
      energy,
      beat,
      spectrum: this._freqData, // full 1024-bin FFT, for e.g. LED walls
      waveform: this._timeData // time-domain samples, for oscilloscope-style visuals
    };
  }

  /** Normalized [0,1] average magnitude for a Hz range. */
  _bandAverage([loHz, hiHz], binHz) {
    const loBin = Math.max(0, Math.floor(loHz / binHz));
    const hiBin = Math.min(this._freqData.length - 1, Math.ceil(hiHz / binHz));
    let sum = 0;
    for (let i = loBin; i <= hiBin; i++) sum += this._freqData[i];
    const count = Math.max(1, hiBin - loBin + 1);
    return sum / count / 255; // -> 0..1
  }

  /**
   * Adaptive beat detector: compares instantaneous energy against a
   * rolling average of recent frames. Fires (returns true) when energy
   * spikes above `sensitivity.beatThreshold` * rolling average, with a
   * short refractory period to avoid double-triggering on one hit.
   */
  _detectBeat(energy) {
    this._beatHistory.push(energy);
    if (this._beatHistory.length > this._beatHistorySize) this._beatHistory.shift();

    const avg =
      this._beatHistory.reduce((a, b) => a + b, 0) / this._beatHistory.length || 0;

    const now = this.getCurrentTime();
    const minInterval = 0.12; // seconds, ~500 BPM ceiling
    const isPeak =
      energy > avg * this.sensitivity.beatThreshold &&
      energy > 0.15 &&
      now - this._lastBeatAt > minInterval;

    if (isPeak) this._lastBeatAt = now;
    return isPeak;
  }

  dispose() {
    this._stopSourceNode();
    if (this.context) this.context.close();
    this.context = null;
  }
}
