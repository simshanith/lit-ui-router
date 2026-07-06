import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  // test and test:coverage run concurrently in this directory; sharing
  // node_modules/.vite lets their dep-optimizer runs corrupt each other
  // (browsers collect 0 tests, or the run never finishes).
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
    globals: true,
    include: ['src/specs/**/*.spec.ts'],
    // vitest 4.1.x browser mode intermittently finishes green but never
    // exits on ubuntu runners; hanging-process dumps the open handles so
    // the CI log shows what kept the process alive.
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
    browser: {
      enabled: true,
      headless: true,
      // Every concurrent vitest browser process defaults to port 63315 and
      // races the fallback rebind; a loser's browser can attach to the wrong
      // server (0 tests collected, or the run waits forever — the CI hang).
      // Each test script pins a distinct port via VITEST_BROWSER_API_PORT.
      api: process.env.VITEST_BROWSER_API_PORT
        ? { port: Number(process.env.VITEST_BROWSER_API_PORT) }
        : undefined,
      provider: playwright({}),
      instances: [
        {
          name: 'chrome',
          browser: 'chromium',
          headless: true,
        },
        {
          name: 'firefox',
          browser: 'firefox',
          headless: true,
        },
        {
          name: 'safari',
          browser: 'webkit',
          headless: true,
        },
      ],
    },
  },
});
