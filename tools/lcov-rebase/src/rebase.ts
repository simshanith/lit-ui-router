// Package-relative SF paths (node --test's lcov reporter, vitest's lcov)
// are ambiguous at repo root — four packages own a src/index.ts — and an
// lcov-only upload has no absolute-path sibling report to break the tie,
// so codecov silently drops the ambiguous entry. Repo-relative SF paths
// are the canonical unambiguous form.
import fs from 'node:fs';
import path from 'node:path';

/** Walk up from dir to the workspace root (the pnpm-workspace.yaml holder). */
export const findRepoRoot = (dir: string): string => {
  let current = path.resolve(dir);
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml')))
      return current;
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`no pnpm-workspace.yaml above ${dir}`);
    }
    current = parent;
  }
};

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
