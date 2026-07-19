import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// No spec here needs a real browser: everything is Lit render + synthetic
// events, which happy-dom supports.
export default defineConfig({
  cacheDir: `node_modules/.vite-${process.env.VITEST_BROWSER_API_PORT ?? 'default'}`,
  resolve: {
    alias: {
      // Resolve the workspace peer to its source so tests do not require a
      // prior `lit-ui-router` build.
      'lit-ui-router': fileURLToPath(
        new URL('../lit-ui-router/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'happy-dom',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/specs/**/*.spec.ts'],
    // Per-file isolation for parity with lit-ui-router: the shared
    // custom-elements registry makes isolate:false a footgun, and the
    // measured cost is nil.
    isolate: true,
    // hanging-process logs the open handles in CI
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
    coverage: {
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
  },
});
