import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Plain node under the @lit-labs/ssr DOM shim, where a prerender actually runs; happy-dom would mask the shim's gaps.

const source = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  cacheDir: `node_modules/.vite-${process.env.VITEST_BROWSER_API_PORT ?? 'default'}`,
  resolve: {
    // Workspace peers resolve to source so tests need no prior build; regex finds, since a string `find` would rewrite the subpath specifiers too.
    alias: [
      {
        find: /^lit-ui-router$/,
        replacement: source('../lit-ui-router/src/index.ts'),
      },
      {
        find: /^lit-ui-router\/context$/,
        replacement: source('../lit-ui-router/src/context.ts'),
      },
      {
        find: /^ui-router-server$/,
        replacement: source('../ui-router-server/src/index.ts'),
      },
      {
        find: /^ui-router-server\/location$/,
        replacement: source('../ui-router-server/src/location.ts'),
      },
    ],
  },
  test: {
    name: 'node',
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/specs/**/*.spec.ts'],
    isolate: true,
    // hanging-process logs the open handles in CI
    reporters: process.env.CI ? ['default', 'hanging-process'] : ['default'],
    coverage: {
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['src/specs/**'],
    },
  },
});
