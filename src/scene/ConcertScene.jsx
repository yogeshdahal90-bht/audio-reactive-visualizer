import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';

import StageLights from './StageLights';
import LaserRig from './LaserRig';
import LedWall from './LedWall';
import CrowdParticles from './CrowdParticles';
import FogVolume from './FogEffect';
import { energyToCameraKick, damp } from '../audio/audioMapping';

/**
 * ConcertScene
 * ------------------------------------------------------------------
 * The full 3D stadium viewed from the back of the arena, looking at
 * the main stage. Composed of independently-reactive subsystems so
 * each can be tuned/replaced without touching the others:
 *   - StageLights: spotlights + moving-head pulse on bass
 *   - LaserRig: beat-driven laser sweeps above/around the stage
 *   - LedWall: mid-reactive color-cycling backdrop screen
 *   - CrowdParticles: treble-reactive "phone flashlight" points + fog
 *
 * `metricsRef` is a React ref (see useAudioAnalyzer) holding the latest
 * audio metrics — read every frame inside useFrame, never via props/state,
 * so audio reactivity stays at full frame rate with no re-render cost.
 */
export default function ConcertScene({ metricsRef, sceneSettings, canvasRef, onCanvasReady }) {
  return (
    <Canvas
      // R3F's <Canvas> does not forward a raw DOM ref; grab the real
      // <canvas> element from the created gl context instead so
      // ExportPanel/CanvasRecorder can call captureStream()/toBlob() on it.
      onCreated={(state) => {
        if (canvasRef) canvasRef.current = state.gl.domElement;
        onCanvasReady?.();
      }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      camera={{ position: [0, 6, 26], fov: 55, near: 0.1, far: 300 }}
      shadows
    >
      <color attach="background" args={['#020103']} />
      <fog attach="fog" args={['#020103', 20, 90]} />

      <PerformanceMonitor onDecline={() => sceneSettings?.onQualityDecline?.()} />

      <SceneContents metricsRef={metricsRef} sceneSettings={sceneSettings} />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={sceneSettings?.bloomIntensity ?? 1.1}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Noise opacity={0.025} />
        <Vignette eskil={false} offset={0.25} darkness={0.9} />
      </EffectComposer>

      <CameraRig metricsRef={metricsRef} sceneSettings={sceneSettings} />
    </Canvas>
  );
}

function SceneContents({ metricsRef, sceneSettings }) {
  return (
    <>
      <ambientLight intensity={0.04} color="#301040" />

      {/* Stage floor + simple back wall so the space reads as an arena */}
      <mesh position={[0, -0.5, -4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#0a0a0d" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 8, -20]}>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#050506" metalness={0.2} roughness={0.9} />
      </mesh>

      {/* Arena floor the "crowd" stands on, sloping gently up toward camera */}
      <mesh position={[0, -0.51, 20]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 60]} />
        <meshStandardMaterial color="#060608" roughness={1} />
      </mesh>

      <StageLights metricsRef={metricsRef} />
      <LaserRig metricsRef={metricsRef} />
      <LedWall metricsRef={metricsRef} />
      <CrowdParticles metricsRef={metricsRef} count={sceneSettings?.crowdDensity ?? 4000} />
      <FogVolume metricsRef={metricsRef} />
    </>
  );
}

/** Subtle audio-reactive camera "kick" layered on top of user OrbitControls. */
function CameraRig({ metricsRef, sceneSettings }) {
  const shakeOffset = useRef(0);

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    const kick = energyToCameraKick(m);
    shakeOffset.current = damp(shakeOffset.current, kick, 6, dt);

    if (sceneSettings?.cameraReactivity !== false) {
      state.camera.position.y += Math.sin(state.clock.elapsedTime * 18) * shakeOffset.current * 0.05;
      state.camera.fov = 55 - shakeOffset.current * 4;
      state.camera.updateProjectionMatrix();
    }
  });

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={60}
      maxPolarAngle={Math.PI / 2.05}
      target={[0, 4, -4]}
    />
  );
}
