#!/usr/bin/env node
// Prints the previous release tag of a package — the changelog range start
// the publish workflow pins release-it to (#302) — or nothing on a first
// release, so `PREV_TAG=$(node tools/release/release-prev-tag.ts <pkg> <version>)`
// can never fail the publish just because no earlier tag exists.
//
// This file is the IO shell: it runs `git describe` and delegates all
// decisions to the pure, unit-tested functions in ./release-prev-tag.core.ts.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  describeArgs,
  isFirstReleaseError,
  parsePrevTag,
} from './release-prev-tag.core.ts';

const run = promisify(execFile);

const [packageName, releaseVersion, ...extra] = process.argv.slice(2);
if (!packageName || !releaseVersion || extra.length > 0) {
  console.error(
    'usage: node tools/release/release-prev-tag.ts <package-name> <release-version>',
  );
  process.exit(1);
}

try {
  const { stdout } = await run(
    'git',
    describeArgs(packageName, releaseVersion),
  );
  const prevTag = parsePrevTag(stdout);
  if (prevTag !== undefined) console.log(prevTag);
} catch (error) {
  // First release: stay silent and exit 0 — empty output means "no override".
  // Anything else still exits 0 (matching the inline `|| true` this replaces)
  // but surfaces git's stderr so an unexpected failure is at least visible.
  const stderr =
    error !== null &&
    typeof error === 'object' &&
    'stderr' in error &&
    typeof error.stderr === 'string'
      ? error.stderr
      : '';
  if (!isFirstReleaseError(stderr))
    console.error(stderr === '' ? error : stderr);
}
