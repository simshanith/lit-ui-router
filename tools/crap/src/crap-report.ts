#!/usr/bin/env node
// Print a package's CRAP hotspots from the coverage its test:coverage wrote.
// Report-only: exits 0 whatever the scores.
// Usage (from the package dir): crap-report [top]
import fs from 'node:fs';
import path from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { analyze } from 'crap4ts';
import * as v from 'valibot';

import { formatReport, packageRelative, rank } from './report.ts';

const sourceRoot = 'src';

const coveragePath = 'coverage/coverage-final.json';

const main = (): void => {
  const top = Number(process.argv[2] ?? 10);

  if (!Number.isInteger(top) || top < 0) {
    console.error('usage: crap-report [top]');
    process.exitCode = 1;

    return;
  }

  if (!fs.existsSync(coveragePath)) {
    console.error(`crap-report: no ${coveragePath}; run test:coverage first`);
    process.exitCode = 1;

    return;
  }

  const coverage = v.parse(
    v.record(v.string(), v.unknown()),
    JSON.parse(fs.readFileSync(coveragePath, 'utf8')),
  );

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
};

if (import.meta.main) main();
