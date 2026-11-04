import { defineConfig, devices } from '@playwright/test';

import { e2eUrl } from './scripts/base-url.ts';

export default defineConfig({
  testDir: './src/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: e2eUrl('app/'),
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // the runner image's Chrome, the one the Cypress suites drive: the e2e job installs no Playwright browsers
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
