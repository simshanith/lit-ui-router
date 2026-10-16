import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { MountConfig } from '../src/index.ts';

// The three emits build:js writes, imported as consumers resolve them: the
// `development` condition picks dist/development, `node` picks dist/node, the
// default picks dist.
type Entry = typeof import('../src/index.ts');

const load = async <T>(path: string): Promise<T> =>
  // SAFETY: each emit is compiled from the src module the caller names
  (await import(new URL(path, import.meta.url).href)) as T;

const BUILDS = ['development', 'node', 'production'] as const;

type Build = (typeof BUILDS)[number];

const dir = (build: Build): string =>
  build === 'production' ? '../dist/' : `../dist/${build}/`;

// SAFETY: one [build, entries] pair per BUILDS member
const builds = Object.fromEntries(
  await Promise.all(
    BUILDS.map(async (build) => [
      build,
      { index: await load<Entry>(`${dir(build)}index.js`) },
    ]),
  ),
) as Record<Build, { index: Entry }>;

const mounts = {
  '/app': { routes: [{ name: 'a', url: '/a' }] },
  '/served': { routes: [{ name: 'root', url: '' }] },
  // Ignored, so no build warns about it or returns it.
  '/quiet': {
    routes: [{ name: 'a', url: '/a' }],
    ignoreDiagnostics: ['bareBaseNotFound'],
  },
} satisfies Record<string, MountConfig>;

const withNodeEnv = (t: TestContext, value: string | undefined): void => {
  const previous = process.env.NODE_ENV;

  t.after(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });

  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
};

const warnings = (t: TestContext, build: Build) => {
  const messages: string[] = [];

  const warn = t.mock.method(console, 'warn', (message: string) => {
    messages.push(message);
  });

  builds[build].index.createServerRouter({ mounts });
  warn.mock.restore();

  return messages;
};

const expected = (build: Build): string[] => {
  const { createServerRouter, diagnoseMounts } = builds[build].index;
  const [{ message }] = diagnoseMounts(createServerRouter({ mounts }));

  return [`ui-router-server: createServerRouter: ${message}`];
};

describe('development, node and production builds', () => {
  it('warns at construction in the development build only, whatever NODE_ENV', (t) => {
    withNodeEnv(t, 'production');
    t.mock.method(console, 'warn', () => {});

    assert.deepEqual(warnings(t, 'development'), expected('development'));
    assert.deepEqual(warnings(t, 'production'), []);
  });

  for (const [nodeEnv, warns] of [
    [undefined, true],
    ['development', true],
    ['test', true],
    ['production', false],
  ] as const) {
    it(`warns in the node build unless NODE_ENV is production (NODE_ENV=${nodeEnv})`, (t) => {
      withNodeEnv(t, nodeEnv);
      const silent = t.mock.method(console, 'warn', () => {});
      const messages = expected('node');
      silent.mock.restore();

      assert.deepEqual(warnings(t, 'node'), warns ? messages : []);
    });
  }

  it('returns the same diagnostics from every build, for its own routers only', (t) => {
    t.mock.method(console, 'warn', () => {});

    const [first, ...rest] = BUILDS.map((build) => {
      const { createServerRouter, diagnoseMounts } = builds[build].index;

      return diagnoseMounts(createServerRouter({ mounts }));
    });

    assert.equal(first.length, 1);

    for (const findings of rest) assert.deepEqual(findings, first);

    const foreign = builds.development.index.createServerRouter({ mounts });
    assert.throws(
      () => builds.production.index.diagnoseMounts(foreign),
      /this copy of ui-router-server/,
    );
  });

  it('ships no console call in the production emit, and process only in the node emit', () => {
    for (const build of BUILDS) {
      const out = fileURLToPath(new URL(dir(build), import.meta.url));

      for (const file of globSync('*.js', { cwd: out })) {
        const code = readFileSync(`${out}${file}`, 'utf8');

        if (build === 'production') assert.doesNotMatch(code, /console/, file);

        if (build !== 'node')
          assert.doesNotMatch(code, /\bprocess\b/, `${build}/${file}`);
      }
    }
  });
});
