import { defineConfig } from 'vite';

// Minimal config. Three.js ships ES modules and example addons under
// `three/examples/jsm/*`, which Vite resolves out of the box.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2020', sourcemap: false }
});
