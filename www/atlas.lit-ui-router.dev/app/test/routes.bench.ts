/**
 * The atlas mount on `ui-router-server`'s two route indexes, timed the way
 * `apps/sample-app-routes/test/routes.bench.ts` times the sample app's mounts:
 * each case once per index, task beside task, so the ratio is within-run.
 *
 * Run `npm run bench`; `BENCH_TIME_MS` sets tinybench's budget per task. The
 * mount is the real one (`mountsFor` over the drawn sheet numbers), so the
 * cases include what the sample app has none of: 29 redirect rules ahead of
 * the route index, and a sheet param narrowed to an alternation.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bench } from 'tinybench';
import { createServerRouter, routeTrie } from 'ui-router-server';
import type { RouteDeclaration, ServerRouter } from 'ui-router-server';
import type { Manifest } from '../src/manifest.ts';
import { allSheets } from '../src/manifest.ts';
import { MOUNT, mountsFor } from '../src/routes.ts';

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'public', 'manifest.json'), 'utf8'),
) as Manifest;
const nums = allSheets(manifest).map((sheet) => sheet.num);
const mounts = mountsFor(nums);
const config = mounts[MOUNT];
assert.ok(config, `a mount at ${MOUNT}`);
const withTrie = { [MOUNT]: { ...config, routeIndex: routeTrie } };

const INDEXES = [
  ['linear', createServerRouter({ mounts })],
  ['trie', createServerRouter({ mounts: withTrie })],
] as const;
const [[, linear], [, trie]] = INDEXES;

/** Each url-bearing state's full url, nested urls appended, in declaration order. */
const routeUrls = (routes: readonly RouteDeclaration[]): string[] => {
  const urlOf = new Map<string, string>();
  for (const route of routes) {
    if (route.url === undefined) continue;
    const parent = route.name.substring(0, route.name.lastIndexOf('.'));
    urlOf.set(route.name, `${urlOf.get(parent) ?? ''}${route.url}`);
  }
  return [...urlOf.values()];
};

// A narrowed `{num:(?:…)}` param takes a drawn number; a plain `:param` takes 42.
const sample = nums[0];
assert.ok(sample, 'a drawn sheet number');
const filled = (url: string): string =>
  url.replace(/\?.*$/, '').replaceAll(/\{num:[^}]*\}/g, sample).replaceAll(/:\w+/g, '42');

const base = MOUNT === '/' ? '' : MOUNT;
const hits = routeUrls(config.routes).map((url) => `${base}${filled(url)}`);
const deepest = hits.reduce((a, b) => (b.length > a.length ? b : a));
const lowercased = nums.find((num) => num !== num.toLowerCase());
assert.ok(lowercased, 'a cased sheet number, for the redirect-rule case');

const cases = [
  [`hit (${hits.length} routes)`, hits],
  ['hit, slash spelling', hits.map((path) => `${path}/`)],
  ['redirect rule, lowercase sheet', [`${base}/sheet/${lowercased.toLowerCase()}`]],
  ['miss, number off the alternation', [`${base}/sheet/99`]],
  ['miss, unknown first segment', [`${base}/nope`]],
  ['miss, under a known prefix', [`${deepest}/nope`]],
  ['slash base', [`${base}/`]],
  ['bare base', [base]],
] as const;

// A trie verdict that drifted from linear would time the wrong branch.
for (const [, paths] of cases)
  for (const path of paths) assert.deepEqual(await trie.resolve(path), await linear.resolve(path), path);

// Rotates through `paths` so no single entry is the only one measured.
const rotating = (router: ServerRouter, paths: readonly string[]) => {
  let next = 0;
  return () => router.resolve(paths[next++ % paths.length] ?? '');
};

const raw = process.env.BENCH_TIME_MS;
const budget = raw ? { time: Number(raw), warmupTime: Number(raw) / 4 } : {};
const bench = new Bench({ name: 'atlas routes resolve', throws: true, ...budget });

bench
  .add('construct [linear]', () => {
    createServerRouter({ mounts });
  })
  .add('construct [trie]', () => {
    createServerRouter({ mounts: withTrie });
  });
for (const [name, paths] of cases)
  for (const [label, router] of INDEXES) bench.add(`${name} [${label}]`, rotating(router, paths));

await bench.run();

console.log(`${process.version} ${process.platform}-${process.arch}`);
console.table(bench.table());

// `throws: true` leaves every task completed; the narrowing makes the statistics typed.
const done = bench.tasks.map(({ name, result }) => {
  assert.strictEqual(result.state, 'completed', name);
  return { name, latency: result.latency };
});

// The ratio per case, trie over linear, on mean latency: under 1 is the trie ahead.
const mean = new Map(done.map(({ name, latency }) => [name, latency.mean]));
for (const name of ['construct', ...cases.map(([name]) => name)]) {
  const ratio = (mean.get(`${name} [trie]`) ?? NaN) / (mean.get(`${name} [linear]`) ?? NaN);
  console.log(`${name.padEnd(36)} trie / linear = ${ratio.toFixed(2)}`);
}

const out = join(import.meta.dirname, '..', '.cache', 'routes-bench.json');
mkdirSync(join(import.meta.dirname, '..', '.cache'), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify(
    done.map(({ name, latency }) => ({
      name,
      ns: { mean: latency.mean * 1e6, p75: latency.p75 * 1e6 },
      rme: latency.rme,
      samples: latency.samplesCount,
      node: process.version,
      timestamp: new Date().toISOString(),
    })),
    null,
    2,
  )}\n`,
);
console.log(`wrote ${out}`);
