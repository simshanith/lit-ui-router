import assert from 'node:assert/strict';

import { Bench } from 'tinybench';

import { createServerRouter } from '../src/index.ts';
import type {
  MountConfig,
  RouteDeclaration,
  ServerRouter,
  Verdict,
} from '../src/index.ts';

const SIZES = [10, 100, 500] as const;

const STRATEGIES = ['matcher', 'simulate'] as const;

const MOUNT = '/app';

type Strategy = (typeof STRATEGIES)[number];

// Cycles static, param, inline-regexp and squashed-optional segments.
const routeAt = (i: number): RouteDeclaration => {
  switch (i % 4) {
    case 0:
      return { name: `static${i}`, url: `/static-${i}` };
    case 1:
      return { name: `param${i}`, url: `/param-${i}/:id` };
    case 2:
      return { name: `regexp${i}`, url: `/regexp-${i}/{id:[0-9]+}` };
    default:
      return {
        name: `squash${i}`,
        url: `/squash-${i}/:section`,
        params: { section: { value: 'intro', squash: true } },
      };
  }
};

// `size` routes in all: the generated mix plus one redirectTo state.
const mountConfig = (size: number, strategy: Strategy): MountConfig => ({
  strategy,
  routes: [
    ...Array.from({ length: size - 1 }, (_, i) => routeAt(i)),
    { name: 'legacy', url: '/legacy', redirectTo: 'static0' },
  ],
  redirects: [{ pattern: '/old/:id', to: 'param1' }],
});

// The last route of each kind, so a linear scan pays for the whole table.
const hitPaths = (size: number): string[] => {
  const last = (kind: number) => size - 2 - ((size - 2 - kind + 4) % 4);

  return [
    `${MOUNT}/static-${last(0)}`,
    `${MOUNT}/param-${last(1)}/abc`,
    `${MOUNT}/regexp-${last(2)}/42`,
    `${MOUNT}/squash-${last(3)}`,
  ];
};

const MISS = `${MOUNT}/no/such/route`;

const REDIRECTS = [`${MOUNT}/legacy`, `${MOUNT}/old/7`];

const config = (size: number, strategy: Strategy) => ({
  mounts: { [MOUNT]: mountConfig(size, strategy) },
});

// Rotates through `paths` so no single entry is the only one measured.
const rotating = (router: ServerRouter, paths: string[]) => {
  let next = 0;

  return () => router.resolve(paths[next++ % paths.length]);
};

const assertKind = async (
  router: ServerRouter,
  paths: string[],
  kind: Verdict['kind'],
) => {
  for (const path of paths)
    assert.equal((await router.resolve(path)).kind, kind, path);
};

const bench = new Bench({ name: 'ui-router-server resolve', throws: true });

for (const strategy of STRATEGIES) {
  for (const size of SIZES) {
    const table = config(size, strategy);
    const router = createServerRouter(table);
    const hits = hitPaths(size);

    // A mis-generated table would silently time the wrong branch.
    await assertKind(router, hits, 'shell');
    await assertKind(router, [MISS], 'notFound');
    await assertKind(router, REDIRECTS, 'redirect');

    bench
      .add(`${strategy} construct n=${size}`, () => {
        createServerRouter(table);
      })
      .add(`${strategy} hit n=${size}`, rotating(router, hits))
      .add(`${strategy} miss n=${size}`, () => router.resolve(MISS))
      .add(`${strategy} redirect n=${size}`, rotating(router, REDIRECTS));
  }
}

await bench.run();

console.log(`${process.version} ${process.platform}-${process.arch}`);

console.table(bench.table());
