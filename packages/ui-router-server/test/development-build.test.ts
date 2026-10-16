import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { MountConfig } from '../src/index.ts';

// The two emits build:js writes, imported as consumers resolve them: the
// `development` condition picks dist/development, the default picks dist.
type Entry = typeof import('../src/index.ts');

type ViteEntry = typeof import('../src/vite.ts');

const load = async <T>(path: string): Promise<T> =>
  // SAFETY: each emit is compiled from the src module the caller names
  (await import(new URL(path, import.meta.url).href)) as T;

const builds = {
  development: await load<Entry>('../dist/development/index.js'),
  production: await load<Entry>('../dist/index.js'),
};

const vite = {
  development: await load<ViteEntry>('../dist/development/vite.js'),
  production: await load<ViteEntry>('../dist/vite.js'),
};

const mounts = {
  '/app': { routes: [{ name: 'a', url: '/a' }] },
  '/served': { routes: [{ name: 'root', url: '' }] },
} satisfies Record<string, MountConfig>;

const warnings = (t: TestContext, { createServerRouter }: Entry) => {
  const messages: string[] = [];

  const warn = t.mock.method(console, 'warn', (message: string) => {
    messages.push(message);
  });

  createServerRouter({ mounts });
  warn.mock.restore();

  return messages;
};

describe('development and production builds', () => {
  it('warns at construction in the development build only', (t) => {
    const [{ message }] = builds.development.diagnoseMounts(mounts);

    assert.deepEqual(warnings(t, builds.development), [
      `ui-router-server: createServerRouter: ${message}`,
    ]);
    assert.deepEqual(warnings(t, builds.production), []);
  });

  it('reports once per router when the Vite plugin wraps either build', (t) => {
    for (const build of ['development', 'production'] as const) {
      const consoleWarn = t.mock.method(console, 'warn', () => {});
      const logged: string[] = [];
      const router = builds[build].createServerRouter({ mounts });

      vite[build].serverRouterPlugin(router).configureServer({
        middlewares: { use: () => {} },
        config: { logger: { warn: (message) => logged.push(message) } },
      });
      consoleWarn.mock.restore();

      assert.equal(consoleWarn.mock.callCount() + logged.length, 1, build);
      assert.equal(logged.length, build === 'production' ? 1 : 0, build);
    }
  });

  it('returns the same diagnostics from both builds', () => {
    assert.equal(builds.production.diagnoseMounts(mounts).length, 1);
    assert.deepEqual(
      builds.production.diagnoseMounts(mounts),
      builds.development.diagnoseMounts(mounts),
    );
  });

  it('ships no console call in the production emit', () => {
    const dist = fileURLToPath(new URL('../dist/', import.meta.url));

    for (const file of globSync('*.js', { cwd: dist })) {
      assert.doesNotMatch(
        readFileSync(`${dist}${file}`, 'utf8'),
        /console/,
        file,
      );
    }
  });
});
