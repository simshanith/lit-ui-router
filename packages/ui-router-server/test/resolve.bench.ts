import assert from 'node:assert/strict';
import { join } from 'node:path';

import { benchBudget, benchReport } from '@tools/shared/bench-report.ts';
import { Bench } from 'tinybench';

import { createServerRouter } from '../src/index.ts';
import type { ServerRouter, Verdict } from '../src/index.ts';
import { stubDev } from './import-meta-env.ts';
import { config, hitPaths, MISS, REDIRECTS, SIZES } from './route-tables.ts';

// Times what dist/*.js runs: construction diagnostics fire in development only.
stubDev(false);

const STRATEGIES = ['matcher', 'simulate'] as const;

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

// Reads --json / --json-out before the run, so a bad flag fails fast.
const report = benchReport({
  defaultPath: join(import.meta.dirname, '..', '.cache', 'resolve-bench.json'),
});

const bench = new Bench({
  name: 'ui-router-server resolve',
  throws: true,
  ...benchBudget(),
});

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

report.console.log(`${process.version} ${process.platform}-${process.arch}`);

report.console.table(bench.table());

await report.write(bench.tasks);
