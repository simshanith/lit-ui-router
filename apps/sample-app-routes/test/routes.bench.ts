import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

const headSha = (): string | null => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
};

const run = {
  timestamp: new Date().toISOString(),
  sha: process.env.GITHUB_SHA ?? headSha(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
};

const ns = (ms: number) => ms * 1e6;

// github-action-benchmark customSmallerIsBetter entries; its schema strips the extra flat keys.
const records = bench.tasks.map(({ name, result }) => {
  if (result.state !== 'completed') throw new Error(`${name}: ${result.state}`);

  const { latency } = result;

  return {
    name,
    unit: 'ns',
    value: ns(latency.mean),
    range: `± ${latency.rme.toFixed(2)}%`,
    extra: `${latency.samplesCount} samples`,
    n: urlOf.size,
    mean: ns(latency.mean),
    p75: ns(latency.p75),
    p99: ns(latency.p99),
    min: ns(latency.min),
    max: ns(latency.max),
    rme: latency.rme,
    samples: latency.samplesCount,
    ...run,
  };
});

// Lands at the package's gitignored .cache unless `--json <path>` overrides it.
const jsonFlag = process.argv.indexOf('--json');

const jsonPath =
  jsonFlag === -1
    ? join(import.meta.dirname, '..', '.cache', 'routes-bench.json')
    : process.argv[jsonFlag + 1];

if (!jsonPath || jsonPath.startsWith('--'))
  throw new Error('--json requires a file path argument');

mkdirSync(dirname(jsonPath), { recursive: true });

writeFileSync(jsonPath, `${JSON.stringify(records, null, 2)}\n`);

console.log(`wrote ${jsonPath}`);
