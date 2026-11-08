import { defineConfig, devices } from '@playwright/test';

import { e2eUrl } from './scripts/base-url.ts';
import type { LocationPlugin } from './src/playwright/app/fixtures.ts';

// the runner image's Chrome, the one the Cypress suites drive: the e2e job installs no Playwright browsers
const chrome = { ...devices['Desktop Chrome'], channel: 'chrome' };

// One project per Cypress suite; each runs every app spec against its mount and location plugin.
const apps = {
  vanilla: { path: 'app/', locationPlugin: '' },
  pushstate: { path: 'app/', locationPlugin: 'pushState' },
  hash: { path: 'app-hash/', locationPlugin: 'hash' },
  mobx: { path: 'app-mobx/', locationPlugin: '' },
  effect: { path: 'app-effect/', locationPlugin: '' },
  signals: { path: 'app-signals/', locationPlugin: '' },
} satisfies Record<string, { path: string; locationPlugin: LocationPlugin }>;

export default defineConfig<{ locationPlugin: LocationPlugin }>({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...Object.entries(apps).map(([name, { path, locationPlugin }]) => ({
      name,
      testDir: './src/playwright/app',
      use: { ...chrome, baseURL: e2eUrl(path), locationPlugin },
    })),
    {
      name: 'docs',
      testDir: './src/playwright/docs',
      use: { ...chrome, baseURL: e2eUrl('') },
    },
  ],
});
