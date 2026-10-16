import assert from 'node:assert/strict';
import { join } from 'node:path';

import { benchBudget, writeBenchReport } from '@tools/shared/bench-report.ts';
import { Bench } from 'tinybench';
import { createServerRouter, routeTrie } from 'ui-router-server';
import type { MountConfig, ServerRouter, Verdict } from 'ui-router-server';

import { mounts } from '../src/routes.ts';
import { filled, routeUrls, withRouteIndex } from './mount-paths.ts';

// Resolves through ui-router-server's dist: build it first, or this times stale emit.

// Each matcher mount runs once per index, task beside task, so the ratio is within-run.
const INDEXES = [
  ['linear', withRouteIndex(mounts, undefined)],
  ['trie', withRouteIndex(mounts, routeTrie)],
] as const;

const routers = INDEXES.map(
  ([label, table]) => [label, createServerRouter({ mounts: table })] as const,
);

const [[, linear], [, trie]] = routers;

// Rotates through `paths` so no single entry is the only one measured.
const rotating = (router: ServerRouter, paths: string[]) => {
  let next = 0;

  return () => router.resolve(paths[next++ % paths.length]);
};

const assertVerdict = async (path: string, expected: Verdict) => {
  assert.deepEqual(await linear.resolve(path), expected, path);
};

const bench = new Bench({
  name: 'sample-app-routes resolve',
  throws: true,
  ...benchBudget(),
});

const hitsUnder = (mount: string, config: MountConfig) =>
  routeUrls(config.routes).map((url) => `${mount}${filled(url, '42')}`);

for (const [mount, config] of Object.entries(mounts)) {
  if (config.strategy === 'simulate') continue;

  const hits = hitsUnder(mount, config);
  const deepest = hits.reduce((a, b) => (b.length > a.length ? b : a));

  const cases = [
    [`hit (${hits.length} routes)`, hits],
    ['miss, unknown first segment', [`${mount}/nope`]],
    ['miss, under a known prefix', [`${deepest}/nope`]],
    ['slash base', [`${mount}/`]],
    ['bare base', [mount]],
  ] as const;

  // A trie verdict that drifted from linear would time the wrong branch.
  for (const [, paths] of cases)
    for (const path of paths)
      assert.deepEqual(await trie.resolve(path), await linear.resolve(path));

  for (const [label, table] of INDEXES)
    bench.add(`${mount} construct [${label}]`, () => {
      createServerRouter({ mounts: { [mount]: table[mount] } });
    });

  for (const [name, paths] of cases)
    for (const [label, router] of routers)
      bench.add(`${mount} ${name} [${label}]`, rotating(router, [...paths]));
}

// The simulate mount takes no routeIndex: its rows are linear-only.
const simulated = '/simulated-routing';

const simulatedHits = hitsUnder(simulated, mounts[simulated]);

for (const hit of simulatedHits)
  await assertVerdict(hit, { kind: 'shell', mount: simulated });

await assertVerdict(`${simulated}/`, {
  kind: 'redirect',
  mount: simulated,
  location: `${simulated}/welcome`,
  status: 302,
});

await assertVerdict(`${simulated}/nope`, {
  kind: 'shell',
  mount: simulated,
  status: 404,
});

bench
  .add(
    `${simulated} hit (${simulatedHits.length} routes)`,
    rotating(linear, simulatedHits),
  )
  .add(`${simulated} root redirect`, () => linear.resolve(`${simulated}/`))
  .add(`${simulated} miss`, () => linear.resolve(`${simulated}/nope`));

await bench.run();

console.log(`${process.version} ${process.platform}-${process.arch}`);

console.table(bench.table());

const reportPath = await writeBenchReport(bench.tasks, {
  defaultPath: join(import.meta.dirname, '..', '.cache', 'routes-bench.json'),
  sizeOf: () => routeUrls(mounts['/app'].routes).length,
});

console.log(`wrote ${reportPath}`);
