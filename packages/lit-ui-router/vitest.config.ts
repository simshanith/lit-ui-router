import { configDefaults, defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// partition: every spec runs in exactly one project
const allSpecs = ['src/specs/**/*.spec.ts'];
// Real user gestures (modifier/middle/right click via page.elementLocator);
// every other spec uses synthetic events that happy-dom supports.
const browserOnlySpecs = ['src/specs/ui-sref.spec.ts'];

// Key caches by the API port so the concurrently running `test` and
// `test:coverage` turbo tasks never share a Vite dep-optimizer dir.
const cacheKey = process.env.VITEST_BROWSER_API_PORT ?? 'default';

// VITE_EXPECT_LIT_MAJOR=2 (test:lit2-compat) resolves every lit import —
// root and subpath — to the lit-2 alias devDep. Applied per project: inline
// projects do NOT inherit a root-level resolve.alias. The VITE_ prefix
// carries the same variable into import.meta.env everywhere (browser
// included), where vitest.setup.ts asserts the swap took.
const lit2Compat = process.env.VITE_EXPECT_LIT_MAJOR === '2';
const litResolve = {
  alias: lit2Compat
    ? [
        { find: /^lit$/, replacement: 'lit-2' },
        { find: /^lit\/(.+)$/, replacement: 'lit-2/$1' },
      ]
    : [],
};

export default defineConfig({
  cacheDir: `node_modules/.vite-${cacheKey}`,
  test: {
    // hanging-process logs the open handles in CI
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
    coverage: {
      reporter: ['text', 'json', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
    projects: [
      {
        cacheDir: `node_modules/.vite-${cacheKey}-happy-dom`,
        resolve: litResolve,
        test: {
          name: 'happy-dom',
          globals: true,
          environment: 'happy-dom',
          setupFiles: ['./vitest.setup.ts'],
          include: allSpecs,
          exclude: [...configDefaults.exclude, ...browserOnlySpecs],
          // Per-file isolation is required: register*.spec.ts assert about
          // custom-elements registry state (element not yet defined,
          // duplicate-definition guard), which a shared registry breaks.
          isolate: true,
        },
      },
      {
        cacheDir: `node_modules/.vite-${cacheKey}-browser`,
        resolve: litResolve,
        test: {
          name: 'browser',
          globals: true,
          setupFiles: ['./vitest.setup.ts', './vitest.setup.browser.ts'],
          include: browserOnlySpecs,
          // vitest 5 moved the browser server port to test.api
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
