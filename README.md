# 🎛️ Audio-Reactive Visualizer

Turn any track into a rendered 3D concert music video, in the browser.

A 3D stadium — lasers, moving-head spotlights, an LED wall, and a crowd of
phone flashlights — reacts in real time to an uploaded audio file's bass,
mids, treble, and beats, and can be exported straight to MP4/WebM with the
audio baked in.

![status](https://img.shields.io/badge/status-alpha-orange)
![license](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **3D concert scene** — stadium viewed from the back of the arena facing
  the main stage, with moving-head spotlights, a laser rig, an LED video
  wall, stage haze, and a crowd particle field standing in for phone
  flashlights.
- **Real FFT audio analysis** — Web Audio API `AnalyserNode` drives bass /
  mid / treble / overall energy metrics plus an adaptive beat detector,
  60 times a second.
- **Configurable audio → visual mapping** — bass pulses stage lights, highs
  brighten the crowd, mids drive the LED wall's color cycle, and beats
  re-aim the laser sweep. All of it lives in one file
  (`src/audio/audioMapping.js`) so it's easy to retune or extend.
- **Full player controls** — upload `.mp3`/`.wav`, play/pause, scrub the
  timeline, orbit the camera, and tweak reactivity sensitivity live.
- **Two export paths**:
  - **Quick Record** — real-time `canvas.captureStream()` +
    `MediaRecorder` capture, muxed with the live audio graph. Fast, WebM
    output, great for previews/shares.
  - **Render MP4** — deterministic, frame-by-frame offline render via
    `ffmpeg.wasm`. Steps the scene forward exactly `1/fps` seconds per
    frame regardless of how fast/slow the machine renders, guaranteeing
    frame-accurate audio sync in the final MP4.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | **React + Vite** | Fast dev loop, huge ecosystem, trivial to deploy as a static site (GitHub Pages / Netlify / Vercel) — no backend required. |
| 3D rendering | **Three.js via React Three Fiber (+ drei, postprocessing)** | Three.js is the most mature WebGL engine with the widest browser support; R3F lets the scene graph live as composable React components (`<StageLights/>`, `<LaserRig/>`, etc.) instead of one imperative blob, which matters a lot once contributors start adding new rig pieces. `drei`/`postprocessing` give bloom, vignette, and camera helpers for free. |
| Audio analysis | **native Web Audio API (`AnalyserNode`)** | Zero dependencies, runs entirely client-side, and is the same primitive every other audio-reactive tool (Butterchurn, Wavesurfer plugins, etc.) is built on. `meyda` is included as an optional dependency for teams who want higher-level features (MFCC, spectral centroid) beyond the bass/mid/treble/beat split shipped here. |
| State | **Zustand** | Minimal boilerplate for the small slice of state that *should* trigger re-renders (UI settings). Per-frame audio metrics deliberately bypass state/props entirely via a `ref`, so 60fps audio reactivity never touches React's render cycle. |
| Live export | **`MediaRecorder` + `canvas.captureStream()`** | Built into every modern browser, no dependencies, real-time. The right default for "just give me a shareable clip." |
| Offline export | **`ffmpeg.wasm`** | The only way to guarantee frame-accurate audio/video sync when the render is too complex to hit real time on a given machine — the app fully controls simulation time instead of racing the wall clock, then hands frames + audio to a real H.264/AAC encoder running in-browser (no server, no upload). |

**Why not a Python/Node desktop wrapper (Electron/PyQt)?** This stays a
static, installable-in-30-seconds web app that runs anywhere — no native
build step, no per-OS binaries, no code signing. If you need guaranteed
GPU performance for very long/high-res renders, the offline pipeline in
`CanvasRecorder.js` is structured so the "advance simulation → grab frame
→ encode" loop can be lifted almost as-is into a Node + `headless-gl`/
Puppeteer batch renderer later, without touching the audio-mapping or
scene code.

---

## Repository Structure

```
audio-reactive-visualizer/
├── README.md
├── LICENSE
├── package.json
├── vite.config.js            # incl. cross-origin isolation headers for ffmpeg.wasm
├── index.html
├── public/
└── src/
    ├── main.jsx               # React entry point
    ├── App.jsx                # top-level layout: scene + HUD panels
    ├── App.css                # HUD/control-room styling
    │
    ├── scene/                 # everything Three.js / R3F
    │   ├── ConcertScene.jsx   # Canvas, camera rig, postprocessing, composition
    │   ├── StageLights.jsx    # moving-head spotlights, bass-reactive pulse
    │   ├── LaserRig.jsx       # beat-reactive laser sweep fan
    │   ├── LedWall.jsx        # mid-reactive shader backdrop
    │   ├── CrowdParticles.jsx # treble-reactive "phone flashlight" field
    │   └── FogEffect.jsx      # stage haze / atmosphere
    │
    ├── audio/                 # everything Web Audio API
    │   ├── AudioEngine.js     # decode, play/pause/seek, FFT metrics, beat detection
    │   ├── useAudioAnalyzer.js# React hook binding AudioEngine to the UI + a metrics ref
    │   └── audioMapping.js    # pure functions: metrics -> scene parameters
    │
    ├── export/                 # recording & rendering
    │   ├── CanvasRecorder.js  # LiveCanvasRecorder (MediaRecorder) + renderOffline (ffmpeg.wasm)
    │   └── ExportPanel.jsx    # UI wiring for both export paths
    │
    ├── ui/
    │   ├── PlayerControls.jsx # upload, play/pause, scrub
    │   └── SensitivityPanel.jsx # live reactivity/bloom sliders
    │
    └── store/
        └── useVisualizerStore.js # Zustand store for UI-level scene settings
```

---

## Architecture Overview

```
 ┌────────────────┐     decode/play     ┌────────────────────┐
 │  Uploaded file  │ ───────────────────▶│    AudioEngine      │
 │  (.mp3 / .wav)  │                     │ (Web Audio + FFT)   │
 └────────────────┘                     └─────────┬───────────┘
                                                    │ getMetrics() every rAF
                                                    ▼
                                        ┌────────────────────────┐
                                        │  metricsRef (React ref) │  ← no re-render
                                        └───────────┬────────────┘
                                                    │ read inside useFrame
                                                    ▼
                          ┌──────────────────────────────────────────┐
                          │           audioMapping.js                │
                          │  bass → stage pulse   treble → crowd glow │
                          │  mid  → LED cycle      beat  → laser sweep│
                          └───────────────┬────────────────────────┘
                                          ▼
                          ┌──────────────────────────────────────────┐
                          │        ConcertScene (R3F / Three.js)      │
                          │  StageLights · LaserRig · LedWall ·       │
                          │  CrowdParticles · FogEffect · Camera rig  │
                          └───────────────┬────────────────────────┘
                                          ▼
                                 <canvas> (WebGL2)
                                          │
                       ┌──────────────────┴──────────────────┐
                       ▼                                     ▼
           LiveCanvasRecorder                        renderOffline()
       (captureStream + MediaRecorder)              (step time → snapshot
              → .webm, real time                     → ffmpeg.wasm mux)
                                                          → .mp4, frame-exact
```

**Key design decision — metrics live in a ref, not in state.** Audio
analysis runs at animation-frame rate (~60Hz). If `bass`/`mid`/`treble`
were stored in React state, every frame would trigger a re-render of the
whole component tree. Instead, `useAudioAnalyzer` writes metrics into a
plain `useRef` object; only the Three.js scene (inside `useFrame`, which
runs outside React's render cycle) and the offline renderer ever read it.
UI elements that *do* need to re-render (the timeline scrubber) are synced
from a separately throttled `setState` call.

---

## Getting Started

### Prerequisites

- Node.js **18.18+** (LTS recommended)
- A recent Chromium, Firefox, or Safari build (WebGL2 + Web Audio API +
  `MediaRecorder` required; `ffmpeg.wasm` needs `SharedArrayBuffer`, which
  `vite.config.js` enables via COOP/COEP headers)

### Install & run

```bash
git clone https://github.com/<your-org>/audio-reactive-visualizer.git
cd audio-reactive-visualizer
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`), upload a
`.mp3` or `.wav`, and hit play.

### Build for production

```bash
npm run build
npm run preview   # serve the production build locally, with the same
                   # COOP/COEP headers ffmpeg.wasm needs
```

The build output in `dist/` is a fully static site — deploy it to GitHub
Pages, Netlify, Vercel, or any static host. **Make sure your host sends
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`** (see `vite.config.js`) or
the offline MP4 export will fail to load `ffmpeg.wasm`.

---

## Usage

1. **Upload** a track via the panel in the top-left HUD.
2. **Play/pause/scrub** with the transport controls; orbit the camera by
   dragging on the canvas, zoom with scroll.
3. **Tune reactivity** with the sensitivity sliders — bass/mid/treble gain
   and beat-detection threshold all update live, no reload needed.
4. **Export**:
   - *Quick Record* for an instant WebM clip of what you're seeing.
   - *Render MP4* to walk away and come back to a frame-accurate MP4 —
     ideal for the final upload-quality export, especially on slower GPUs.

---

## Extending

- **New reactive elements** — add a component under `src/scene/`, then add
  one mapping function in `src/audio/audioMapping.js`. Keep scene
  components reading `metricsRef.current` inside `useFrame`, never via
  props, to preserve 60fps reactivity.
- **New audio features** (e.g. spectral centroid, key detection) — `meyda`
  is already a dependency; wire it into `AudioEngine.getMetrics()` and
  extend the returned metrics object.
- **Higher-res / longer offline renders** — `renderOffline()` in
  `CanvasRecorder.js` already decouples simulation time from wall-clock
  time; increasing canvas resolution or frame count doesn't require
  architecture changes, just more patience (and it's a natural place to
  eventually swap in a server-side headless-GL batch renderer for very
  long renders).

---

## Contributing

Issues and PRs welcome. Please keep the three concerns —**measuring**
audio (`audio/`), **mapping** it to parameters (`audioMapping.js`), and
**rendering** it (`scene/`) — cleanly separated; that boundary is what
keeps this codebase easy to extend.

## License

[MIT](./LICENSE)
