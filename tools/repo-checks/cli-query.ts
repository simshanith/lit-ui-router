// The one place these checks shell out. node parses JSON and nothing else, so
// the config formats this repo asserts against are read through the CLIs that
// already own them: taplo is its TOML linter and formatter, yq its YAML query
// tool, and both take a jq-like path and answer in JSON. Both are mise-pinned,
// so a check reads the same tool CI does.
//
// File sets come from git rather than a directory walk, the way the taplo task
// selects its TOML set.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

/** `taplo get` on a repo-relative TOML file, parsed. */
export const taploGet = (file: string, pattern: string): unknown =>
  JSON.parse(
    execFileSync(
      'taplo',
      ['get', '-f', join(workspaceRoot, file), '-o', 'json', pattern],
      { encoding: 'utf8' },
    ),
  );

/** `yq` on a repo-relative YAML file, parsed. */
export const yqGet = (file: string, expression: string): unknown =>
  JSON.parse(
    execFileSync('yq', ['-o=json', expression, join(workspaceRoot, file)], {
      encoding: 'utf8',
    }),
  );

/** Repo-relative paths of the tracked files matching a git pathspec. */
export const trackedFiles = (pattern: string): string[] =>
  execFileSync('git', ['ls-files', '--', pattern], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
