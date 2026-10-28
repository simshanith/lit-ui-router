import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  cacheDir: `node_modules/.vite-${process.env.VITEST_BROWSER_API_PORT ?? 'default'}`,
  test: {
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // github-actions precedes the failure banner; hanging-process logs open handles in CI
    reporters: [
      ...(process.env.GITHUB_ACTIONS === 'true'
        ? [new GithubActionsReporter({ jobSummary: { enabled: false } })]
        : []),
      'default',
      ...(process.env.CI ? (['hanging-process'] as const) : []),
    ],
    api: process.env.VITEST_BROWSER_API_PORT
      ? { port: Number(process.env.VITEST_BROWSER_API_PORT) }
      : undefined,
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
