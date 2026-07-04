import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
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
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
    browser: {
      enabled: true,
      headless: true,
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
