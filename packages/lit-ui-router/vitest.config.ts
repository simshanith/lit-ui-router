import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/specs/**/*.ts'],
    globals: true,
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
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
