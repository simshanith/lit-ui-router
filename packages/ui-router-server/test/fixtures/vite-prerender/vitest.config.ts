import { defineConfig } from 'vitest/config';

// Run by vite-prerender.test.ts: vitest's own --conditions and happy-dom's globals around a build.
export default defineConfig({
  test: {
    include: ['vitest-build.spec.ts'],
    environment: 'happy-dom',
  },
});
