#!/usr/bin/env node
// Rewrite each lcov file's relative SF paths to repo-relative, in place.
// Run from the package that produced the report — the package dir is the
// base the reporter's relative paths mean.
// Usage (from the package dir): rebase-lcov <lcov-file> [...]
import fs from 'node:fs';
import path from 'node:path';

import { workspaceRoot } from '@tools/shared/workspace.ts';

import { rebaseLcov } from './rebase.ts';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: rebase-lcov <lcov-file> [...]');
  process.exit(1);
}

const packageDir = path
  .relative(workspaceRoot, process.cwd())
  .split(path.sep)
  .join('/');

for (const file of files) {
  fs.writeFileSync(file, rebaseLcov(fs.readFileSync(file, 'utf8'), packageDir));
}
