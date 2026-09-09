// Where the repo is, for tooling that cannot ask a package manager.
//
// The workspace enumeration lives in @tools/shared instead: it is pnpm's own
// resolver and so needs an install, where the root is arithmetic and needs
// nothing.
//
// Depth is load-bearing: the root is counted up from this module, so the file
// must stay three levels below the root. That is why bootstrap's sources sit in
// `src/` — the same depth as `tools/shared/src`, so moving a module between the
// two packages is a file move and nothing else.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the workspace root. */
export const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
