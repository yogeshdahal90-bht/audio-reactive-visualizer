import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { beatToLaserSweepAngle, damp } from '../audio/audioMapping';

const LASER_COUNT = 8;
const LASER_COLORS = ['#00f0ff', '#ff00d4', '#7dff00', '#ff5a00'];

/**
 * LaserRig
 * ------------------------------------------------------------------
 * Fan of thin emissive beams mounted at the front of the stage.
 * Each beat detected by AudioEngine advances a shared "beat counter";
 * beams re-target to a new deterministic sweep angle on every beat,
 * and continuously ease toward that target for a smooth sweep motion.
 */
export default function LaserRig({ metricsRef }) {
  const groupRef = useRef();
  const beatCount = useRef(0);
  const wasBeat = useRef(false);
  const targetAngles = useRef(new Array(LASER_COUNT).fill(0));
  const currentAngles = useRef(new Array(LASER_COUNT).fill(0));

  const beams = useMemo(
    () =>
      new Array(LASER_COUNT).fill(0).map((_, i) => ({
        color: LASER_COLORS[i % LASER_COLORS.length],
        originX: (i - LASER_COUNT / 2) * 1.1
      })),
    []
  );

  useFrame((state, dt) => {
    const m = metricsRef?.current;

    if (m?.beat && !wasBeat.current) {
      beatCount.current += 1;
      for (let i = 0; i < LASER_COUNT; i++) {
        targetAngles.current[i] = beatToLaserSweepAngle(beatCount.current + i * 3.1, {
          spread: Math.PI * 0.7
        });
      }
    }
    wasBeat.current = !!m?.beat;

    if (groupRef.current) {
      groupRef.current.children.forEach((beamGroup, i) => {
        currentAngles.current[i] = damp(currentAngles.current[i], targetAngles.current[i], 3, dt);
        beamGroup.rotation.z = currentAngles.current[i];
        // Idle slow rotation layered on top so it's never fully static
        beamGroup.rotation.y = Math.sin(state.clock.elapsedTime * 0.4 + i) * 0.15;

        const beam = beamGroup.children[0];
        if (beam) {
          const flicker = m?.energy ? 0.6 + m.energy * 0.4 : 0.5;
          beam.material.opacity = flicker;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 2.5, -6]}>
      {beams.map((b, i) => (
        <group key={i} position={[b.originX, 0, 0]}>
          <mesh position={[0, 9, 0]}>
            <cylinderGeometry args={[0.015, 0.12, 18, 8, 1, true]} />
            <meshBasicMaterial
              color={b.color}
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
