#!/usr/bin/env node
// Print a package's CRAP hotspots from the coverage its test:coverage wrote.
// Report-only: exits 0 whatever the scores.
// Usage (from the package dir): crap-report [top]
import fs from 'node:fs';
import path from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { Json } from '@tools/bootstrap/types.ts';
import { analyze } from 'crap4ts';

import { formatReport, packageRelative, rank } from './report.ts';

const sourceRoot = 'src';

const coveragePath = 'coverage/coverage-final.json';

const top = Number(process.argv[2] ?? 10);

if (!Number.isInteger(top) || top < 0) {
  console.error('usage: crap-report [top]');
  process.exit(1);
}

if (!fs.existsSync(coveragePath)) {
  console.error(`crap-report: no ${coveragePath}; run test:coverage first`);
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8')) as Readonly<
  Record<string, Json>
>;

const packageDir = path
  .relative(workspaceRoot, process.cwd())
  .split(path.sep)
  .join('/');

const coveredFiles = new Set(
  Object.keys(coverage).flatMap(
    (key) => packageRelative(key, packageDir) ?? [],
  ),
);

const report = rank(
  analyze({ sourceRoot, coveragePath }),
  sourceRoot,
  coveredFiles,
);

console.log(formatReport(path.basename(process.cwd()), report, top));
