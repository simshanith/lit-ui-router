import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/specs/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
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
