import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { StateRegistry } from '@uirouter/core';

import { createServerRouter } from '../src/index.ts';
import type { MountConfig, ServerRouter } from '../src/index.ts';
import {
  config,
  hitPaths,
  MISS,
  MOUNT,
  mountConfig,
  REDIRECTS,
  SIZES,
} from './route-tables.ts';

// The generated tables leave the bare mount base unserved.
mock.method(console, 'warn', () => {});

// Every generated table holds `size` url routes plus one string when()-rule.
const compiledPatterns = (size: number) => size + 1;

interface Built<T> {
  built: T;
  patterns: RegExp[];
}

// The anchored regexps (route and rule patterns) `build` constructs.
const patternsBuiltBy = <T>(build: () => T): Built<T> => {
  const patterns: RegExp[] = [];
  const original = globalThis.RegExp;

  globalThis.RegExp = new Proxy(original, {
    construct(target, args, newTarget) {
      const regexp: unknown = Reflect.construct(target, args, newTarget);
      assert.ok(regexp instanceof original);

      if (regexp.source.startsWith('^')) patterns.push(regexp);

      return regexp;
    },
  });

  try {
    return { built: build(), patterns };
  } finally {
    globalThis.RegExp = original;
  }
};

const repeatedSources = (regexps: RegExp[]): string[] => {
  const counts = new Map<string, number>();

  for (const { source } of regexps)
    counts.set(source, (counts.get(source) ?? 0) + 1);

  return [...counts].flatMap(([source, count]) => (count > 1 ? [source] : []));
};

describe('matcher strategy work per resolve', () => {
  for (const size of SIZES) {
    describe(`n=${size}`, () => {
      const { built: router, patterns } = patternsBuiltBy(() =>
        createServerRouter(config(size, 'matcher')),
      );

      const tablePatterns = new Set(patterns);

      const workFor = async (path: string) => {
        const exec = mock.method(RegExp.prototype, 'exec');
        const decode = mock.method(globalThis, 'decodeURIComponent');

        try {
          const { kind } = await router.resolve(path);

          const execs = exec.mock.calls.flatMap(({ this: regexp }) =>
            regexp instanceof RegExp && tablePatterns.has(regexp)
              ? [regexp]
              : [],
          );

          return {
            kind,
            execs: execs.length,
            rescanned: repeatedSources(execs),
            decodes: decode.mock.callCount(),
          };
        } finally {
          exec.mock.restore();
          decode.mock.restore();
        }
      };

      // Rules first, then every route: matchRoute keeps the most specific match, so it never exits early.
      const fullScan = { execs: compiledPatterns(size), rescanned: [] };

      it('runs each pattern at most once and decodes each param once on a hit', async () => {
        const [staticHit, paramHit, regexpHit, squashHit] = hitPaths(size);

        assert.deepEqual(await workFor(staticHit), {
          kind: 'shell',
          ...fullScan,
          decodes: 0,
        });
        assert.deepEqual(await workFor(paramHit), {
          kind: 'shell',
          ...fullScan,
          decodes: 1,
        });
        assert.deepEqual(await workFor(regexpHit), {
          kind: 'shell',
          ...fullScan,
          decodes: 1,
        });
        assert.deepEqual(await workFor(squashHit), {
          kind: 'shell',
          ...fullScan,
          decodes: 0,
        });
      });

      it('runs each pattern at most once on a miss', async () => {
        assert.deepEqual(await workFor(MISS), {
          kind: 'notFound',
          ...fullScan,
          decodes: 0,
        });
      });

      it('runs each pattern at most once on a redirect', async () => {
        const [stateRedirect, ruleRedirect] = REDIRECTS;

        assert.deepEqual(await workFor(stateRedirect), {
          kind: 'redirect',
          ...fullScan,
          decodes: 0,
        });
        // A matching when()-rule decides before any route runs.
        assert.deepEqual(await workFor(ruleRedirect), {
          kind: 'redirect',
          execs: 1,
          rescanned: [],
          decodes: 1,
        });
      });
    });
  }
});

// A headless router registers its states into its own registry, so distinct registries are builds.
const buildsDuring = async <T>(work: () => Promise<T>) => {
  const register = mock.method(StateRegistry.prototype, 'register');

  try {
    const result = await work();
    const registries = new Set(register.mock.calls.map((call) => call.this));

    return { result, builds: registries.size };
  } finally {
    register.mock.restore();
  }
};

const resolveEach = async (router: ServerRouter, paths: string[]) => {
  for (const path of paths) await router.resolve(path);
};

describe('simulate strategy router builds', () => {
  for (const size of SIZES) {
    it(`builds no router for sequential requests on a warm pool (n=${size})`, async () => {
      const router = createServerRouter(config(size, 'simulate'));
      const paths = [...hitPaths(size), MISS, ...REDIRECTS];
      await router.resolve(MISS);

      const { builds } = await buildsDuring(() =>
        resolveEach(router, [...paths, ...paths]),
      );

      assert.equal(builds, 0);
    });
  }

  it('builds at most one router per concurrent request on a cold mount', async () => {
    const router = createServerRouter(config(10, 'simulate'));
    const paths = [...hitPaths(10), MISS, ...REDIRECTS, ...hitPaths(10)];

    const burst = () => Promise.all(paths.map((path) => router.resolve(path)));

    const cold = await buildsDuring(burst);
    assert.ok(
      cold.builds >= 1 && cold.builds <= paths.length,
      `${cold.builds}`,
    );

    const warm = await buildsDuring(burst);
    assert.equal(warm.builds, 0);
  });

  // Data-only declarations can't fail or hang a transition; a core resolve can.
  const failing = {
    name: 'boom',
    url: '/boom',
    resolve: [
      { token: 'boom', resolveFn: () => Promise.reject(new Error('boom')) },
    ],
  };

  const hanging = {
    name: 'hang',
    url: '/hang',
    resolve: [{ token: 'never', resolveFn: () => new Promise(() => {}) }],
  };

  const withRoutes = (mount: MountConfig): MountConfig => ({
    ...mount,
    routes: [...mount.routes, failing, hanging],
  });

  for (const path of [`${MOUNT}/boom`, `${MOUNT}/hang`]) {
    it(`builds exactly one replacement after ${path}`, async () => {
      const router = createServerRouter({
        mounts: { [MOUNT]: withRoutes(mountConfig(10, 'simulate')) },
      });

      const [hit] = hitPaths(10);
      await router.resolve(hit);

      const dropped = await buildsDuring(() => router.resolve(path));
      assert.deepEqual(dropped, {
        result: { kind: 'shell', mount: MOUNT },
        builds: 0,
      });

      assert.equal((await buildsDuring(() => router.resolve(hit))).builds, 1);
      assert.equal((await buildsDuring(() => router.resolve(hit))).builds, 0);
    });
  }
});

describe('mount construction', () => {
  for (const strategy of ['matcher', 'simulate'] as const) {
    for (const size of SIZES) {
      it(`compiles each pattern once (${strategy}, n=${size})`, () => {
        const { patterns } = patternsBuiltBy(() =>
          createServerRouter(config(size, strategy)),
        );

        assert.deepEqual(
          {
            compiled: patterns.length,
            recompiled: repeatedSources(patterns),
          },
          { compiled: compiledPatterns(size), recompiled: [] },
        );
      });
    }
  }
});
