import { useRef, useState } from 'react';
import ConcertScene from './scene/ConcertScene';
import PlayerControls from './ui/PlayerControls';
import SensitivityPanel from './ui/SensitivityPanel';
import ExportPanel from './export/ExportPanel';
import useAudioAnalyzer from './audio/useAudioAnalyzer';
import useVisualizerStore from './store/useVisualizerStore';
import './App.css';

export default function App() {
  const audioApi = useAudioAnalyzer();
  const [audioFile, setAudioFile] = useState(null);
  const canvasRef = useRef(null);
  // Mirrors canvasRef.current into state once R3F's onCreated fires, so
  // ExportPanel (which needs the live <canvas> element) actually re-renders
  // with it — a plain ref mutation alone wouldn't trigger that re-render.
  const [canvasReady, setCanvasReady] = useState(false);

  const sceneSettings = useVisualizerStore();

  const loadFile = async (file) => {
    setAudioFile(file);
    await audioApi.loadFile(file);
  };

  return (
    <div className="app">
      <div className="app__stage">
        <ConcertScene
          metricsRef={audioApi.metricsRef}
          sceneSettings={sceneSettings}
          canvasRef={canvasRef}
          onCanvasReady={() => setCanvasReady(true)}
        />
      </div>

      <div className="app__hud">
        <header className="app__header">
          <h1>Audio-Reactive Visualizer</h1>
          <p>Upload a track, tune reactivity, and export a synced music video.</p>
        </header>

        <PlayerControls audioApi={{ ...audioApi, loadFile }} />
        <SensitivityPanel audioApi={audioApi} />
        <ExportPanel audioApi={audioApi} canvasEl={canvasReady ? canvasRef.current : null} audioFile={audioFile} />
      </div>
    </div>
  );
}
