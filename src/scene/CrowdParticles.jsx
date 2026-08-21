import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { trebleToCrowdBrightness, damp } from '../audio/audioMapping';

/**
 * CrowdParticles
 * ------------------------------------------------------------------
 * Represents the crowd as a dense field of small emissive points
 * ("phone flashlights") scattered across the arena floor/stands.
 * Treble energy raises overall brightness and adds per-point sparkle
 * (a subset randomly flares brighter each frame) so high-hats/vocals
 * read as visible "phones going up" moments.
 */
export default function CrowdParticles({ metricsRef, count = 4000 }) {
  const pointsRef = useRef();
  const brightness = useRef(0.2);

  const { positions, sparkleSeed } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sparkleSeed = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Fan the crowd out across a wide arc behind/around the camera start point,
      // roughly matching the arena floor plane defined in ConcertScene.
      const radius = 6 + Math.random() * 30;
      const angle = (Math.random() - 0.5) * Math.PI * 0.95;
      const x = Math.sin(angle) * radius;
      const z = 6 + Math.cos(angle) * radius * 0.9;
      const y = 0.2 + Math.random() * 1.6 + (radius / 36) * 3; // stands slope upward

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sparkleSeed[i] = Math.random() * Math.PI * 2;
    }
    return { positions, sparkleSeed };
  }, [count]);

  const material = useRef();

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    const target = trebleToCrowdBrightness(m, { base: 0.25, gain: 2.2 });
    brightness.current = damp(brightness.current, target, 6, dt);

    if (material.current) {
      material.current.opacity = Math.min(1, brightness.current);
      material.current.size = 0.12 + brightness.current * 0.15;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        color="#bfe8ff"
        size={0.14}
        transparent
        opacity={0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}
