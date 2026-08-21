import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bassToStagePulse, damp } from '../audio/audioMapping';

const RIG_COLORS = ['#ff2fd0', '#2fd4ff', '#7c3aff', '#ff8a2f'];

/**
 * StageLights
 * ------------------------------------------------------------------
 * A small rig of moving-head spotlights arranged above/around the
 * stage. Bass energy drives both intensity (pulse) and a slow swing
 * so the rig feels alive even during sustained bass.
 */
export default function StageLights({ metricsRef }) {
  const lights = useMemo(
    () => [
      { pos: [-8, 10, -6], color: RIG_COLORS[0], swing: 0.6 },
      { pos: [8, 10, -6], color: RIG_COLORS[1], swing: -0.6 },
      { pos: [-4, 11, -8], color: RIG_COLORS[2], swing: 0.9 },
      { pos: [4, 11, -8], color: RIG_COLORS[3], swing: -0.9 },
      { pos: [0, 12, -9], color: '#ffffff', swing: 0.3 }
    ],
    []
  );

  return (
    <group>
      {/* Static key/fill so the stage isn't pitch black between hits */}
      <spotLight
        position={[0, 14, 4]}
        angle={0.6}
        penumbra={0.6}
        intensity={4}
        color="#8a3bff"
        castShadow
        target-position={[0, 0, -6]}
      />
      {lights.map((cfg, i) => (
        <MovingHead key={i} metricsRef={metricsRef} {...cfg} index={i} />
      ))}

      {/* LED-wall style floor washers along the stage lip */}
      <StageEdgeStrip metricsRef={metricsRef} />
    </group>
  );
}

function MovingHead({ pos, color, swing, index, metricsRef }) {
  const lightRef = useRef();
  const targetRef = useRef();
  const pulse = useRef(0.4);

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    const target = bassToStagePulse(m, { base: 0.5, gain: 6 });
    pulse.current = damp(pulse.current, target, 8, dt);

    if (lightRef.current) {
      lightRef.current.intensity = pulse.current;
    }
    if (targetRef.current) {
      const t = state.clock.elapsedTime;
      targetRef.current.position.x = Math.sin(t * 0.5 + index) * swing * 6;
      targetRef.current.position.z = -6 + Math.cos(t * 0.3 + index) * 2;
    }
  });

  return (
    <>
      <spotLight
        ref={lightRef}
        position={pos}
        angle={0.35}
        penumbra={0.5}
        color={color}
        intensity={0.5}
        distance={40}
        castShadow={false}
      />
      <object3D ref={targetRef} position={[0, 0, -6]} />
      {lightRef.current && (
        <primitive object={lightRef.current.target} position={targetRef.current?.position} />
      )}
    </>
  );
}

/** Thin emissive strip along the stage front edge, brightens with bass. */
function StageEdgeStrip({ metricsRef }) {
  const matRef = useRef();

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    const target = bassToStagePulse(m, { base: 0.6, gain: 3 });
    if (matRef.current) {
      matRef.current.emissiveIntensity = damp(matRef.current.emissiveIntensity ?? 0.6, target, 10, dt);
    }
  });

  return (
    <mesh position={[0, 0.05, 2]}>
      <boxGeometry args={[16, 0.1, 0.2]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ff2fd0"
        emissive={new THREE.Color('#ff2fd0')}
        emissiveIntensity={0.6}
        toneMapped={false}
      />
    </mesh>
  );
}
