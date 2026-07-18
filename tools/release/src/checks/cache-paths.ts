// Package-local cache dir for resolved release state — gitignored via the
// root `.cache/` convention. Package-relative paths let turbo declare the
// summary as the check task's output, so cache replay materializes it.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives in <package>/src/checks.
export const cacheDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.cache',
);

/** Written by resolve-published.ts, hashed as check:published-diff's input. */
export const publishedVersionsPath = join(cacheDir, 'published-versions.json');

/** Written unconditionally by check-published-diff.ts; the turbo task's output. */
export const publishedDiffSummaryPath = join(
  cacheDir,
  'published-diff-summary.json',
);
