import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { MountConfig } from '../src/index.ts';

// The two emits build:js writes, imported as consumers resolve them: the
// `development` condition picks dist/development, the default picks dist.
type Entry = typeof import('../src/index.ts');

const load = async (path: string): Promise<Entry> =>
  // SAFETY: both emits are compiled from src/index.ts, whose types this names
  (await import(new URL(path, import.meta.url).href)) as Entry;

const builds = {
  development: await load('../dist/development/index.js'),
  production: await load('../dist/index.js'),
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
