#!/usr/bin/env node
// Gate for the `--development` emit split: the dev-only warning messages a
// package declares in dev-warnings.json must ship in dist/development/*.js and
// must NOT ship in dist/*.js, and only the graph of a package.json#imports
// `node` target may mention `process`. Reads the built output, so it runs after build:js.
// Usage (from the package dir): oxc-emit-check-dev-split
import { existsSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';

import {
  findDevSplitViolations,
  findProcessReads,
  formatDevSplitReport,
  type ImportsMap,
  messagePrefix,
  nodeImportRoots,
} from './check-dev-split.core.ts';
import { DEV_OUT, OUT } from './shared.ts';

const CONFIG = 'dev-warnings.json';

const read = (dir: string): string =>
  globSync(join(dir, '*.js'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

const main = (): void => {
  if (!existsSync(CONFIG)) {
    console.error(
      `✗ dev/prod split check failed — ${CONFIG} not found in ${process.cwd()}.`,
    );
    process.exitCode = 1;

    return;
  }

  if (!existsSync(DEV_OUT)) {
    console.error(
      `✗ dev/prod split check failed — ${DEV_OUT}/ is missing; is build:js running with --development?`,
    );
    process.exitCode = 1;

    return;
  }

  // SAFETY: each package hand-authors dev-warnings.json as { devOnly: string[] }
  const { devOnly } = JSON.parse(readFileSync(CONFIG, 'utf8')) as {
    devOnly: string[];
  };

  // dist/*.js is non-recursive, so the dist/development/ emit is not double-read
  const production = read(OUT);

  if (!production) {
    console.error(
      `✗ dev/prod split check failed — ${OUT}/ has no production JavaScript; an empty set would pass vacuously.`,
    );
    process.exitCode = 1;

    return;
  }

  // The undeclared-message scan keys off the package's own name, so a sibling
  // package's prefix (lit-ui-router-mobx:) is never read as lit-ui-router:.
  const manifest = requireManifest(process.cwd());
  const { name } = manifest;

  if (!name) throw new Error('package.json has no name');

  // SAFETY: PackageManifest leaves imports out to stay assignable from pnpm's; ours map conditions to string targets
  const { imports } = manifest as { imports?: ImportsMap };

  const emitted = new Map(
    globSync(join(OUT, '**', '*.js')).map((file) => [
      file,
      readFileSync(file, 'utf8'),
    ]),
  );

  const report = formatDevSplitReport(
    [
      ...findDevSplitViolations({
        prefix: messagePrefix(name),
        devOnly,
        production,
        development: read(DEV_OUT),
      }),
      ...findProcessReads(emitted, nodeImportRoots(imports, [OUT, DEV_OUT])),
    ],
    devOnly.length,
  );

  console[report.ok ? 'log' : 'error'](report.text);

  if (!report.ok) process.exitCode = 1;
};

if (import.meta.main) main();
