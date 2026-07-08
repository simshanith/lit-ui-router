import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  cacheDir: `node_modules/.vite-${process.env.VITEST_BROWSER_API_PORT ?? 'default'}`,
  // The umbrella tsconfig.json includes specs, so oxc discovers
  // experimentalDecorators natively; kept explicit as belt-and-suspenders.
  oxc: { decorator: { legacy: true } },
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
    // hanging-process logs the open handles in CI
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
    browser: {
      enabled: true,
      headless: true,
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
