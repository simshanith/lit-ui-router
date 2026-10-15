import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';

// VITE_EXPECT_MOBX_MAJOR=6 (test:mobx6-compat) resolves mobx to the mobx-6
// alias devDep, proving the widened `^6.0.0 || ^7.0.0` peer range.
const mobx6Compat = process.env.VITE_EXPECT_MOBX_MAJOR === '6';

// No DOM: the router runs on servicesPlugin + memoryLocationPlugin.
export default defineConfig({
  resolve: {
    alias: mobx6Compat ? [{ find: /^mobx$/, replacement: 'mobx-6' }] : [],
  },
  test: {
    name: 'node',
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/specs/**/*.spec.ts'],
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
      exclude: ['src/specs/**'],
    },
  },
});
