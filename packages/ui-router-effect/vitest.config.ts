import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';

// No DOM: the router runs on servicesPlugin + memoryLocationPlugin.
export default defineConfig({
  test: {
    name: 'node',
    globals: true,
    environment: 'node',
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
