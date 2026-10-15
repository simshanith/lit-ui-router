import assert from 'node:assert/strict';

import { Bench } from 'tinybench';
import { createServerRouter } from 'ui-router-server';
import type { ServerRouter, Verdict } from 'ui-router-server';

import { mounts, routes } from '../src/routes.ts';

// Resolves through ui-router-server's dist: build it first, or this times stale emit.
const urlOf = new Map<string, string>();

// Full paths for every url-bearing state, params filled with a sample value.
for (const route of routes) {
  if (route.url === undefined) continue;

  const parent = route.name.substring(0, route.name.lastIndexOf('.'));
  const url = `${urlOf.get(parent) ?? ''}${route.url}`;
  urlOf.set(route.name, url);
}

const hitPaths = [...urlOf.values()].map((url) =>
  url.replaceAll(/:\w+/g, '42'),
);

// The flagship matcher mount and the one simulate mount, as the worker serves them.
const SCENARIOS = [
  { mount: '/app', miss: { kind: 'notFound', mount: '/app' } },
  {
    mount: '/simulated-routing',
    miss: { kind: 'shell', mount: '/simulated-routing', status: 404 },
  },
] as const;

// Rotates through `paths` so no single entry is the only one measured.
const rotating = (router: ServerRouter, paths: string[]) => {
  let next = 0;

  return () => router.resolve(paths[next++ % paths.length]);
};

const router = createServerRouter({ mounts });

const assertVerdict = async (path: string, expected: Verdict) => {
  assert.deepEqual(await router.resolve(path), expected, path);
};

const bench = new Bench({ name: 'sample-app-routes resolve', throws: true });

bench.add('construct', () => {
  createServerRouter({ mounts });
});

for (const { mount, miss } of SCENARIOS) {
  const hits = hitPaths.map((path) => `${mount}${path}`);
  const missPath = `${mount}/nope`;
  const rootPath = `${mount}/`;

  // A drifted table would silently time the wrong branch.
  for (const hit of hits) await assertVerdict(hit, { kind: 'shell', mount });

  await assertVerdict(rootPath, {
    kind: 'redirect',
    mount,
    location: `${mount}/welcome`,
    status: 302,
  });
  await assertVerdict(missPath, miss);

  bench
    .add(`${mount} hit (${hits.length} routes)`, rotating(router, hits))
    .add(`${mount} root redirect`, () => router.resolve(rootPath))
    .add(`${mount} miss`, () => router.resolve(missPath));
}

await bench.run();

console.log(`${process.version} ${process.platform}-${process.arch}`);

console.table(bench.table());
