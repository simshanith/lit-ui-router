// Where the repo is, for tooling that cannot ask a package manager.
//
// This lives in @tools/bootstrap rather than next to the workspace enumeration
// in @tools/shared because the two answer different questions. Enumeration
// needs pnpm's own resolver and so needs an install; the root is arithmetic on
// this file's own location and needs nothing. Keeping them together meant every
// consumer that only wanted the path took a dependency on the pnpm SDK, and the
// one consumer that runs before `pnpm install` could not take the path at all.
//
// Depth is load-bearing: this resolves by counting directories up from the
// module, so the file must stay three levels below the root. That is why
// bootstrap's sources sit in `src/` — the same depth as `tools/shared/src`, so
// moving a module between the two packages is a file move and nothing else.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the workspace root. This file lives in <root>/tools/bootstrap/src. */
export const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
