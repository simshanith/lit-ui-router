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

// The `@tools/release#pack` task writes one publish-shape tarball per
// publishable package here; every check reads them instead of re-packing.
// Declared as that task's turbo output (`.cache/pack/*.tgz`), so cache replay
// materializes them for the dependent checks. This is also the CREDIT ledger
// of the publish-path reconciliation (see release-reconcile.ts): the publish
// job restores this CI-verified tarball read-only to cross-check its own bake.
export const packDir = join(cacheDir, 'pack');

/** The stable, version-less tarball path a consumer reads for `name`. */
export const packTarballPath = (name: string): string =>
  join(packDir, `${name}.tgz`);

/** Scratch copies live here; kept out of the `*.tgz` output glob. */
export const packStagingParent = join(packDir, 'staging');

// The DEBIT ledger of the publish-path reconciliation: the publish job
// re-bakes here (cold, off-cache) and Reconcile balances it against the
// CI-verified CREDIT tarball under packDir. Kept OUT of packDir so it can
// never be a turbo-cache-restored artifact — no turbo task declares this path.
export const publishTarballPath = (name: string): string =>
  join(cacheDir, 'publish', `${name}.tgz`);
