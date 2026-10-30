import { defineConfig } from 'vite';

export default defineConfig({
  // Assets emit at absolute /assets/…, which the docs site serves beside every app's.
  base: '/',
  build: { target: 'es2022' },
  server: { port: 5180, strictPort: true, open: false },
  preview: { port: 4180, strictPort: true },
});
