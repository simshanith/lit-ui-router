import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// Two lanes: the server half runs in plain node under the @lit-labs/ssr DOM
// shim, where a prerender actually runs and happy-dom would mask the shim's
// gaps; the client half needs a document to parse markup into and hydrate.

const source = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

// Specs that need a browser-shaped document rather than the SSR DOM shim.
const clientSpecs = ['src/specs/client.spec.ts'];

const cacheKey = process.env.VITEST_BROWSER_API_PORT ?? 'default';

export default defineConfig({
  cacheDir: `node_modules/.vite-${cacheKey}`,
  resolve: {
    // Workspace peers resolve to source so tests need no prior build; regex finds, since a string `find` would rewrite the subpath specifiers too.
    alias: [
      {
        find: /^lit-ui-router$/,
        replacement: source('../lit-ui-router/src/index.ts'),
      },
      {
        find: /^lit-ui-router\/pure$/,
        replacement: source('../lit-ui-router/src/pure.ts'),
      },
      {
        find: /^lit-ui-router\/register$/,
        replacement: source('../lit-ui-router/src/register.ts'),
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
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/specs/**/*.spec.ts'],
          exclude: [...configDefaults.exclude, ...clientSpecs],
          isolate: true,
        },
      },
      {
        cacheDir: `node_modules/.vite-${cacheKey}-happy-dom`,
        test: {
          name: 'happy-dom',
          globals: true,
          environment: 'happy-dom',
          setupFiles: ['./vitest.setup.client.ts'],
          include: clientSpecs,
          isolate: true,
        },
      },
    ],
  },
});
