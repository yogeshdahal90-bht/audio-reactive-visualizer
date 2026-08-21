import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ffmpeg.wasm (multi-threaded) requires SharedArrayBuffer, which in turn
// requires the page to be served as "cross-origin isolated". These headers
// enable that both in dev and in the production preview server.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

export default defineConfig({
  // GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
  // not the domain root, so every asset URL Vite generates needs this prefix.
  // Set VITE_BASE via the Actions workflow below (falls back to '/' for local dev
  // and for Netlify/Vercel/Cloudflare Pages, which serve from the root).
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { headers: crossOriginIsolationHeaders, port: 5173 },
  preview: { headers: crossOriginIsolationHeaders },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  build: {
    target: 'esnext',
    sourcemap: true
  }
});
