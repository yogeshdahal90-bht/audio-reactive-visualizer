import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { damp } from '../audio/audioMapping';

/**
 * FogVolume
 * ------------------------------------------------------------------
 * Cheap "stage haze" using a couple of large, slowly-drifting
 * semi-transparent planes near the stage, plus a gentle pulse of the
 * scene's exponential fog density on strong hits (bass drops feel
 * like a fog-machine blast). Kept simple/GPU-light on purpose —
 * swap for a volumetric shader if you want a heavier look.
 */
export default function FogVolume({ metricsRef }) {
  const fogRef = useRef();
  const opacityA = useRef(0.12);
  const opacityB = useRef(0.08);

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    const kick = m?.beat ? 0.25 : 0;

    opacityA.current = damp(opacityA.current, 0.12 + kick, 4, dt);
    opacityB.current = damp(opacityB.current, 0.08 + kick * 0.6, 3, dt);

    if (state.scene.fog) {
      const targetFar = 90 - (m?.energy ?? 0) * 25;
      state.scene.fog.far = damp(state.scene.fog.far, targetFar, 2, dt);
    }

    if (fogRef.current) {
      fogRef.current.children[0].material.opacity = opacityA.current;
      fogRef.current.children[1].material.opacity = opacityB.current;
      fogRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <group ref={fogRef} position={[0, 3, -4]}>
      <mesh position={[-4, 0, 2]} rotation={[0, 0.4, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshBasicMaterial color="#8a6bff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh position={[5, -1, 3]} rotation={[0, -0.5, 0]}>
        <planeGeometry args={[16, 6]} />
        <meshBasicMaterial color="#2fd4ff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}
