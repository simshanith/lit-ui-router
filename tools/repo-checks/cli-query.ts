// File sets come from git rather than a directory walk, the way the taplo task
// selects its TOML set. TOML values come from @tools/shared/taplo.ts.

import { execFileSync } from 'node:child_process';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

/** Repo-relative paths of the tracked files matching any of the pathspecs. */
export const trackedFiles = (...patterns: string[]): string[] =>
  execFileSync('git', ['ls-files', '--', ...patterns], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
