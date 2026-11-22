// node parses JSON and nothing else, so TOML is read through taplo, the repo's
// mise-pinned TOML linter and formatter: `get` takes a jq-like path and prints
// JSON. Tooling only; the Workers Builds image has no mise, so no taplo.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import type { Json } from '@tools/bootstrap/types.ts';

/** `taplo get` on a repo-relative TOML file, parsed. */
export const taploGet = (file: string, pattern: string): Json =>
  // SAFETY: JSON.parse yields only JSON values
  JSON.parse(
    execFileSync(
      'taplo',
      ['get', '-f', join(workspaceRoot, file), '-o', 'json', pattern],
      { encoding: 'utf8' },
    ),
  ) as Json;
