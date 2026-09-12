import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// No spec here needs a real browser: everything is Lit render + synthetic
// events, which happy-dom supports.

// VITE_EXPECT_LIT_MAJOR=2 (test:lit2-compat) resolves every lit import —
// root and subpath, including lit-ui-router's source via the alias below —
// to the lit-2 alias devDep. The VITE_ prefix carries the same variable into
// import.meta.env, where vitest.setup.ts asserts the swap took.
const lit2Compat = process.env.VITE_EXPECT_LIT_MAJOR === '2';

export default defineConfig({
  cacheDir: `node_modules/.vite-${process.env.VITEST_BROWSER_API_PORT ?? 'default'}`,
  resolve: {
    alias: [
      // Resolve the workspace peer to its source so tests do not require a
      // prior `lit-ui-router` build.
      {
        find: 'lit-ui-router',
        replacement: fileURLToPath(
          new URL('../lit-ui-router/src/index.ts', import.meta.url),
        ),
      },
      ...(lit2Compat
        ? [
            { find: /^lit$/, replacement: 'lit-2' },
            { find: /^lit\/(.+)$/, replacement: 'lit-2/$1' },
          ]
        : []),
    ],
  },
  test: {
    name: 'happy-dom',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/specs/**/*.spec.ts'],
    // A custom-elements registry shared across spec files is a footgun;
    // keep per-file isolation.
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
