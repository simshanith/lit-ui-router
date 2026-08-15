import { configDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// partition: every spec runs in exactly one project
const allSpecs = ['src/specs/**/*.spec.ts'];
// Pure functions — no DOM at all, so they get plain node speed.
const nodeSpecs = ['src/specs/compose-navigate-url.spec.ts'];
// This plugin wraps the Navigation API (window.navigation), which happy-dom
// does not implement. NavigationLocationService reaches it through the
// protected `_navigation()` seam, so specs that only need to observe what we
// pass to the API subclass-and-stub it and run in happy-dom. Only real
// round-trips — navigations that actually commit, events that actually fire —
// need a real browser, and those are the specs listed here.
const browserOnlySpecs = [
  'src/specs/index.spec.ts',
  'src/specs/url-shape.spec.ts',
];

// Key caches by the API port so the concurrently running `test` and
// `test:coverage` turbo tasks never share a Vite dep-optimizer dir.
const cacheKey = process.env.VITEST_BROWSER_API_PORT ?? 'default';

export default defineConfig({
  cacheDir: `node_modules/.vite-${cacheKey}`,
  test: {
    // hanging-process logs the open handles in CI
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
    coverage: {
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
    projects: [
      {
        cacheDir: `node_modules/.vite-${cacheKey}-node`,
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: nodeSpecs,
        },
      },
      {
        cacheDir: `node_modules/.vite-${cacheKey}-happy-dom`,
        test: {
          name: 'happy-dom',
          globals: true,
          environment: 'happy-dom',
          include: allSpecs,
          exclude: [
            ...configDefaults.exclude,
            ...browserOnlySpecs,
            ...nodeSpecs,
          ],
        },
      },
      {
        cacheDir: `node_modules/.vite-${cacheKey}-browser`,
        test: {
          name: 'browser',
          globals: true,
          include: browserOnlySpecs,
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
      },
    ],
  },
});
