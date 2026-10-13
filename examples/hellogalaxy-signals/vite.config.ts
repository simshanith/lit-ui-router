import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    // model-viewer is a single ~1 MB chunk; fine for a demo embed.
    chunkSizeWarningLimit: 1100,
  },
});
