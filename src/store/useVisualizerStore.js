import { create } from 'zustand';

/**
 * Central store for scene-level settings that the UI controls and the
 * 3D scene both read. Kept separate from per-frame audio metrics
 * (which live in a ref, not the store) to avoid re-rendering the whole
 * tree 60 times a second — see useAudioAnalyzer.js.
 */
const useVisualizerStore = create((set) => ({
  crowdDensity: 4000,
  bloomIntensity: 1.1,
  cameraReactivity: true,

  sensitivity: {
    bass: 1.0,
    mid: 1.0,
    treble: 1.0,
    beatThreshold: 1.35
  },

  setSensitivity: (partial) =>
    set((state) => ({ sensitivity: { ...state.sensitivity, ...partial } })),

  setSetting: (key, value) => set({ [key]: value })
}));

export default useVisualizerStore;
