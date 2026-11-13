import { configDefaults, defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';
import type { BrowserCommand } from 'vitest/node';
import { playwright } from '@vitest/browser-playwright';

import packageJson from './package.json' with { type: 'json' };

// Playwright emulates the media feature for the whole page, the tester iframe included.
const reduceMotion: BrowserCommand<[reduce: boolean]> = async (
  context,
  reduce,
) => {
  await context.page.emulateMedia({ reducedMotion: reduce ? 'reduce' : null });
};

// partition: every spec runs in exactly one project
const allSpecs = ['src/specs/**/*.spec.ts'];

// The element opens through the Popover API, which happy-dom does not implement.
const browserOnlySpecs = ['src/specs/element.browser.spec.ts'];

// Key caches by the API port so the concurrently running `test` and
// `test:coverage` turbo tasks never share a Vite dep-optimizer dir.
const cacheKey = process.env.VITEST_BROWSER_API_PORT ?? 'default';

export default defineConfig({
  cacheDir: `node_modules/.vite-${cacheKey}`,
  test: {
    // What oxc-emit-js defines as `import.meta.env.PACKAGE_VERSION` in dist/.
    env: { PACKAGE_VERSION: packageJson.version },
    // github-actions precedes the failure banner; hanging-process logs open handles in CI
    reporters: [
      ...(process.env.GITHUB_ACTIONS === 'true'
        ? [new GithubActionsReporter({ jobSummary: { enabled: false } })]
        : []),
      'default',
      ...(process.env.CI ? (['hanging-process'] as const) : []),
    ],
    coverage: {
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/specs/**'],
    },
    projects: [
      {
        cacheDir: `node_modules/.vite-${cacheKey}-node`,
        test: {
          name: 'node',
          environment: 'node',
          include: allSpecs,
          exclude: [...configDefaults.exclude, ...browserOnlySpecs],
        },
      },
      {
        cacheDir: `node_modules/.vite-${cacheKey}-browser`,
        // The Map loads on first use; a dependency found only then would make Vite reload the test.
        optimizeDeps: {
          include: ['d3-hierarchy', 'lit/directives/repeat.js'],
        },
        test: {
          name: 'browser',
          setupFiles: ['./vitest.setup.ts'],
          include: browserOnlySpecs,
          api: process.env.VITEST_BROWSER_API_PORT
            ? { port: Number(process.env.VITEST_BROWSER_API_PORT) }
            : undefined,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            commands: { reduceMotion },
            instances: [
              { name: 'chrome', browser: 'chromium', headless: true },
              { name: 'firefox', browser: 'firefox', headless: true },
              { name: 'safari', browser: 'webkit', headless: true },
            ],
          },
        },
      },
    ],
  },
});
