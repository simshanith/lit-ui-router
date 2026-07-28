// Package-relative SF paths (node --test's lcov reporter, vitest's lcov)
// are ambiguous at repo root — four packages own a src/index.ts — and an
// lcov-only upload has no absolute-path sibling report to break the tie,
// so codecov silently drops the ambiguous entry. Repo-relative SF paths
// are the canonical unambiguous form.
import path from 'node:path';

/**
 * Rewrite relative SF records to repo-relative form. `packageDir` is the
 * repo-relative directory the report's paths are relative to (the cwd of
 * the test run). Absolute SF paths and non-SF records pass through; `..`
 * segments resolve, so cross-package entries land on their real package.
 */
export const rebaseLcov = (content: string, packageDir: string): string =>
  content.replace(/^SF:(.+)$/gm, (record, sf: string) => {
    if (path.posix.isAbsolute(sf) || path.win32.isAbsolute(sf)) return record;
    return `SF:${path.posix.normalize(path.posix.join(packageDir, sf))}`;
  });
