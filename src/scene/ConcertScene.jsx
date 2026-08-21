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
 * Full stadium scale setup viewed from elevated back seats.
 */
export default function ConcertScene({ metricsRef, sceneSettings, canvasRef, onCanvasReady }) {
  return (
    <Canvas
      onCreated={(state) => {
        if (canvasRef) canvasRef.current = state.gl.domElement;
        onCanvasReady?.();
      }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      // Adjusted camera position and FOV for massive stadium scale
      camera={{ position: [0, 18, 55], fov: 60, near: 0.1, far: 500 }}
      shadows
    >
      <color attach="background" args={['#020103']} />
      {/* Pushed fog boundaries back so stadium tiers stay visible */}
      <fog attach="fog" args={['#020103', 40, 180]} />

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
      <ambientLight intensity={0.06} color="#301040" />

      {/* Main Stage Structure */}
      <mesh position={[0, -0.5, -15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[35, 20]} />
        <meshStandardMaterial color="#0a0a0d" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Stadium Back Wall / Structure */}
      <mesh position={[0, 20, -35]}>
        <planeGeometry args={[120, 60]} />
        <meshStandardMaterial color="#030304" metalness={0.2} roughness={0.9} />
      </mesh>

      <StageLights metricsRef={metricsRef} />
      <LaserRig metricsRef={metricsRef} />
      <LedWall metricsRef={metricsRef} />
      {/* Stadium Tiered Seating & Crowd */}
      <CrowdParticles metricsRef={metricsRef} count={sceneSettings?.crowdDensity ?? 4000} />
      <FogVolume metricsRef={metricsRef} />
    </>
  );
}

/** Audio-reactive camera kick tailored for higher stadium angles */
function CameraRig({ metricsRef, sceneSettings }) {
  const shakeOffset = useRef(0);

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    const kick = energyToCameraKick(m);
    shakeOffset.current = damp(shakeOffset.current, kick, 6, dt);

    if (sceneSettings?.cameraReactivity !== false) {
      state.camera.position.y += Math.sin(state.clock.elapsedTime * 18) * shakeOffset.current * 0.05;
      state.camera.fov = 60 - shakeOffset.current * 3;
      state.camera.updateProjectionMatrix();
    }
  });

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={15}
      maxDistance={120}
      maxPolarAngle={Math.PI / 2.02}
      target={[0, 4, -10]}
    />
  );
}
