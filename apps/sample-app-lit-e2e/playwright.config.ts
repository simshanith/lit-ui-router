import { defineConfig, devices } from '@playwright/test';

import { e2eUrl } from './scripts/base-url.ts';
import type { LocationPlugin } from './src/playwright/app/fixtures.ts';

// Playwright's bundled Chromium, pinned to the installed Playwright version
const chrome = devices['Desktop Chrome'];

// One project per app suite; each runs every app spec against its mount and location plugin.
const apps = {
  vanilla: { path: 'app/', locationPlugin: '' },
  pushstate: { path: 'app/', locationPlugin: 'pushState' },
  hash: { path: 'app-hash/', locationPlugin: 'hash' },
  mobx: { path: 'app-mobx/', locationPlugin: '' },
  effect: { path: 'app-effect/', locationPlugin: '' },
  signals: { path: 'app-signals/', locationPlugin: '' },
} satisfies Record<string, { path: string; locationPlugin: LocationPlugin }>;

// a run empties its projects' outputDir, so each suite keeps its own beside the others it runs with
export default defineConfig<{ locationPlugin: LocationPlugin }>({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // set by scripts/run-e2e.ts when suites share the host; undefined keeps Playwright's default
  workers: process.env.E2E_WORKERS
    ? Number(process.env.E2E_WORKERS)
    : undefined,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...Object.entries(apps).map(([name, { path, locationPlugin }]) => ({
      name,
      testDir: './src/playwright/app',
      outputDir: `test-results/${name}`,
      use: { ...chrome, baseURL: e2eUrl(path), locationPlugin },
    })),
    {
      name: 'docs',
      testDir: './src/playwright/docs',
      outputDir: 'test-results/docs',
      use: { ...chrome, baseURL: e2eUrl('') },
    },
  ],
});
