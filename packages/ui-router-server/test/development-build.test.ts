import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { MountConfig } from '../src/index.ts';

// The two emits build:js writes, imported as consumers resolve them: the
// `development` and `node` conditions pick dist/development, the default picks
// dist. Their #dev-gate goes through package.json#imports, so under this node
// run it reads NODE_ENV.
type Entry = typeof import('../src/index.ts');

const load = async <T>(path: string): Promise<T> =>
  // SAFETY: each emit is compiled from the src module the caller names
  (await import(new URL(path, import.meta.url).href)) as T;

const BUILDS = ['development', 'production'] as const;

type Build = (typeof BUILDS)[number];

const dir = (build: Build): string =>
  build === 'production' ? '../dist/' : '../dist/development/';

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

describe('development and production builds', () => {
  it('never warns at construction in the production build, whatever NODE_ENV', (t) => {
    withNodeEnv(t, undefined);

    assert.deepEqual(warnings(t, 'production'), []);
  });

  for (const [nodeEnv, warns] of [
    [undefined, true],
    ['development', true],
    ['test', true],
    ['production', false],
  ] as const) {
    it(`warns in the development build under node unless NODE_ENV is production (NODE_ENV=${nodeEnv})`, (t) => {
      withNodeEnv(t, nodeEnv);
      const silent = t.mock.method(console, 'warn', () => {});
      const messages = expected('development');
      silent.mock.restore();

      assert.deepEqual(warnings(t, 'development'), warns ? messages : []);
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

  it('builds a router in every build when a bare-base resolve throws', (t) => {
    withNodeEnv(t, undefined);
    t.mock.method(console, 'warn', () => {});

    const tripped = {
      routes: [
        {
          name: 'item',
          url: '/:id',
          params: {
            id: {
              type: {
                name: 'tripped',
                pattern: /[^/]*/,
                is: (_value: unknown): _value is string => {
                  throw new Error('tripped');
                },
                decode: (value: string) => value,
              },
              value: 'x',
              squash: true,
            },
          },
        },
      ],
    } satisfies MountConfig;

    for (const build of BUILDS) {
      const { createServerRouter, diagnoseMounts } = builds[build].index;

      const router = createServerRouter({
        mounts: { ...mounts, '/tripped': tripped },
      });

      assert.deepEqual(
        diagnoseMounts(router).map(({ mount }) => mount),
        ['/app'],
        build,
      );
    }
  });

  it('opens the default #dev-gate whatever NODE_ENV says', async (t) => {
    withNodeEnv(t, 'production');
    const gate = await load<{ devGate: () => boolean }>('../dist/dev-gate.js');

    assert.equal(gate.devGate(), true);
  });

  it('ships no console call in the production emit', () => {
    const out = fileURLToPath(new URL(dir('production'), import.meta.url));

    for (const file of globSync('*.js', { cwd: out })) {
      assert.doesNotMatch(
        readFileSync(`${out}${file}`, 'utf8'),
        /console/,
        file,
      );
    }
  });
});
