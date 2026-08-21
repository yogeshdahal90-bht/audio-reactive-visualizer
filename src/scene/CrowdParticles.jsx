import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useVisualizerStore from '../store/useVisualizerStore';

export default function CrowdParticles() {
  const lightsMeshRef = useRef();
  
  // Access audio analysis values from your Zustand store
  const treble = useVisualizerStore((state) => state.treble || 0);

  // 1. Generate Stadium Tiers, Audience Heads, and Phone Lights
  const { tiers, headInstances, lightInstances } = useMemo(() => {
    const tierCount = 3;
    const radius = 35;
    const heightStep = 6;
    const depthStep = 8;
    const crowdCount = 4000;
    const lightCount = 1200;

    // Tier Geometries
    const generatedTiers = [];
    for (let t = 0; t < tierCount; t++) {
      const innerRadius = radius + t * depthStep;
      const outerRadius = innerRadius + depthStep * 0.85;
      generatedTiers.push({
        innerRadius,
        outerRadius,
        yPos: t * heightStep - 2,
      });
    }

    // Instance Matrices
    const dummy = new THREE.Object3D();
    const headMatrices = [];
    const lightMatrices = [];

    // Populate Heads across curved tiers
    for (let i = 0; i < crowdCount; i++) {
      const t = Math.floor(Math.random() * tierCount);
      const tier = generatedTiers[t];
      const angle = THREE.MathUtils.lerp(Math.PI * 0.18, Math.PI * 0.82, Math.random());
      const r = THREE.MathUtils.lerp(tier.innerRadius, tier.outerRadius, Math.random());

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = tier.yPos + (r - tier.innerRadius) * 0.4;

      dummy.position.set(x, y, z);
      dummy.lookAt(0, 2, -20);
      const scale = 0.8 + Math.random() * 0.3;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      headMatrices.push(dummy.matrix.clone());
    }

    // Populate Phone Lights / Glowsticks
    for (let i = 0; i < lightCount; i++) {
      const t = Math.floor(Math.random() * tierCount);
      const tier = generatedTiers[t];
      const angle = THREE.MathUtils.lerp(Math.PI * 0.18, Math.PI * 0.82, Math.random());
      const r = THREE.MathUtils.lerp(tier.innerRadius, tier.outerRadius, Math.random());

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = tier.yPos + (r - tier.innerRadius) * 0.4 + 0.3;

      dummy.position.set(x, y, z);
      dummy.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      lightMatrices.push(dummy.matrix.clone());
    }

    return { tiers: generatedTiers, headInstances: headMatrices, lightInstances: lightMatrices };
  }, []);

  // Make phone flashlights react dynamically to music treble/highs
  useFrame(() => {
    if (lightsMeshRef.current) {
      lightsMeshRef.current.material.opacity = 0.4 + treble * 0.6;
    }
  });

  return (
    <group>
      {/* Curved Seating Tier Floors */}
      {tiers.map((tier, idx) => (
        <mesh key={idx} position={[0, tier.yPos, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[tier.innerRadius, tier.outerRadius, 64, 1, Math.PI * 0.15, Math.PI * 0.7]} />
          <meshStandardMaterial color="#111318" roughness={0.8} metalness={0.2} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Audience Heads */}
      <instancedMesh
        args={[null, null, headInstances.length]}
        onUpdate={(self) => {
          headInstances.forEach((matrix, i) => self.setMatrixAt(i, matrix));
          self.instanceMatrix.needsUpdate = true;
        }}
      >
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#222226" roughness={0.9} />
      </instancedMesh>

      {/* Glowing Crowd Phone Flashlights */}
      <instancedMesh
        ref={lightsMeshRef}
        args={[null, null, lightInstances.length]}
        onUpdate={(self) => {
          lightInstances.forEach((matrix, i) => self.setMatrixAt(i, matrix));
          self.instanceMatrix.needsUpdate = true;
        }}
      >
        <planeGeometry args={[0.12, 0.12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
