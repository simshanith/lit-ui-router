#!/usr/bin/env node
// Guard against untracked-by-tooling module flavors: every tracked .mjs/.cjs
// file must either become .ts or carry an allowlist entry with a reason.
//
// This file is the IO shell: it enumerates tracked files via git ls-files
// (so node_modules and build output never enter), then delegates all
// decisions to the pure, unit-tested functions in ./check-mjs.core.ts.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { findMjsFindings, formatReport } from './check-mjs.core.ts';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '-z', '--', '*.mjs', '*.cjs'],
    { cwd: repoRoot },
  );
  const trackedFiles = stdout.split('\0').filter((file) => file.length > 0);
  const findings = findMjsFindings(trackedFiles);
  const { ok, text } = formatReport(findings);
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
