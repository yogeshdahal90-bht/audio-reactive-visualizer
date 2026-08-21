/**
 * audioMapping.js
 * ------------------------------------------------------------------
 * Central place that decides what audio metrics DO to the scene.
 * Keeping this separate from AudioEngine (which only measures) and
 * from the scene components (which only render) makes each mapping
 * independently tunable/testable, and is where you'd plug in new
 * behaviors without touching either the analyser or Three.js code.
 *
 * All functions are pure: (metrics, sensitivity) -> plain numbers/flags.
 * Scene components call these inside useFrame with the live metricsRef.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Bass -> stage light pulse intensity (spotlights + LED wall brightness). */
export function bassToStagePulse(metrics, { base = 0.4, gain = 2.2 } = {}) {
  if (!metrics) return base;
  return clamp01(base + metrics.bass * gain);
}

/** Treble/highs -> crowd particle (phone flashlight) brightness & sparkle. */
export function trebleToCrowdBrightness(metrics, { base = 0.15, gain = 1.6 } = {}) {
  if (!metrics) return base;
  return clamp01(base + metrics.treble * gain);
}

/** Mid energy -> LED wall color-cycle speed (vocals/lead instruments live here). */
export function midToLedCycleSpeed(metrics, { base = 0.15, gain = 1.2 } = {}) {
  if (!metrics) return base;
  return base + metrics.mid * gain;
}

/**
 * Beat -> laser sweep target. Every detected beat nudges the laser rig to
 * a new pseudo-random sweep angle so movement feels rhythmic rather than
 * mechanically periodic. `seed` should be a slowly-incrementing counter
 * (e.g. beat count) owned by the caller.
 */
export function beatToLaserSweepAngle(seed, { spread = Math.PI * 0.6 } = {}) {
  // Deterministic pseudo-random so re-renders/exports are reproducible.
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = x - Math.floor(x);
  return (frac - 0.5) * spread;
}

/** Overall energy -> camera micro-shake / FOV punch for impact on drops. */
export function energyToCameraKick(metrics, { gain = 0.35 } = {}) {
  if (!metrics) return 0;
  return metrics.energy * gain;
}

/** Smooth an instant value toward a target — use per-frame for damping. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export default {
  bassToStagePulse,
  trebleToCrowdBrightness,
  midToLedCycleSpeed,
  beatToLaserSweepAngle,
  energyToCameraKick,
  damp
};
