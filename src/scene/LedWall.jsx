import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { midToLedCycleSpeed } from '../audio/audioMapping';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A simple animated gradient + moving bar pattern standing in for a
// video-wall content feed. `uSpectrum` (a 1D texture-less array of 32
// sampled bins) drives per-column brightness so it visibly reacts to
// the mix, not just a global scalar.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uCycleSpeed;
  uniform float uBins[32];
  varying vec2 vUv;

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
  }

  void main() {
    int col = int(vUv.x * 32.0);
    float level = uBins[col];

    float wave = sin(vUv.x * 20.0 - uTime * uCycleSpeed * 4.0) * 0.5 + 0.5;
    vec3 color = palette(uTime * uCycleSpeed * 0.05 + vUv.x * 0.6);

    float bar = step(1.0 - level, vUv.y);
    float glow = smoothstep(0.0, 1.0, level) * (0.3 + 0.7 * wave);

    vec3 finalColor = mix(color * 0.08, color, bar) * (0.4 + glow);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function LedWall({ metricsRef }) {
  const shaderRef = useRef();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCycleSpeed: { value: 0.2 },
      uBins: { value: new Array(32).fill(0) }
    }),
    []
  );

  useFrame((state, dt) => {
    const m = metricsRef?.current;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uCycleSpeed.value = midToLedCycleSpeed(m);

    if (m?.spectrum) {
      // Downsample the 1024-bin FFT into 32 columns for the shader.
      const bins = uniforms.uBins.value;
      const step = Math.floor(m.spectrum.length / 32);
      for (let i = 0; i < 32; i++) {
        bins[i] = m.spectrum[i * step] / 255;
      }
    }
  });

  return (
    <mesh position={[0, 7, -18]}>
      <planeGeometry args={[26, 12]} />
      <shaderMaterial
        ref={shaderRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
}
