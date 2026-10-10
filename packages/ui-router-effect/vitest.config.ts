import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';

// VITE_EXPECT_EFFECT_MAJOR=3 (test:effect3-compat) resolves effect to the
// effect-3 alias devDep, proving the widened `^3.22.0 || ^4.0.2` peer range.
const effect3Compat = process.env.VITE_EXPECT_EFFECT_MAJOR === '3';

// No DOM: the router runs on servicesPlugin + memoryLocationPlugin.
export default defineConfig({
  resolve: {
    alias: effect3Compat ? [{ find: /^effect$/, replacement: 'effect-3' }] : [],
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
