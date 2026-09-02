#!/usr/bin/env node
// Gate for the `--development` emit split: the dev-only warning messages a
// package declares in dev-warnings.json must ship in dist/development/*.js and
// must NOT ship in dist/*.js. Reads the built output, so it runs after build:js.
// Usage (from the package dir): oxc-emit-check-dev-split
import { existsSync, globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  findDevSplitViolations,
  formatDevSplitReport,
} from './check-dev-split.core.ts';
import { DEV_OUT, OUT } from './shared.ts';

const CONFIG = 'dev-warnings.json';

const read = (dir: string): string =>
  globSync(join(dir, '*.js'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

if (!existsSync(CONFIG)) {
  console.error(
    `✗ dev/prod split check failed — ${CONFIG} not found in ${process.cwd()}.`,
  );
  process.exit(1);
}
if (!existsSync(DEV_OUT)) {
  console.error(
    `✗ dev/prod split check failed — ${DEV_OUT}/ is missing; is build:js running with --development?`,
  );
  process.exit(1);
}

const { devOnly } = JSON.parse(readFileSync(CONFIG, 'utf8')) as {
  devOnly: string[];
};
// dist/*.js is non-recursive, so the dist/development/ emit is not double-read
const report = formatDevSplitReport(
  findDevSplitViolations({
    devOnly,
    production: read(OUT),
    development: read(DEV_OUT),
  }),
  devOnly.length,
);
console[report.ok ? 'log' : 'error'](report.text);
if (!report.ok) process.exit(1);
