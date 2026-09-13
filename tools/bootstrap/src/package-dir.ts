// Where a module's own package is, for a script that has to act on its package
// rather than on wherever it was invoked from.
//
// Node's resolver would answer this too, but only for a package that can name
// itself: self-reference needs an `exports` map, and `<name>/package.json` needs
// that map to publish `./package.json`. Neither holds by default — a package
// with no `exports` cannot self-reference at all — so the walk-up is the one
// form that works from any module in any package, and it takes no manifest
// surgery to enable. Counting `..` levels at the call site is the thing it
// replaces: that arithmetic goes silently wrong when a file moves.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readManifest } from './manifest.ts';

/** Absolute path to the nearest directory at or above `moduleUrl` holding a package.json. */
export function packageDir(moduleUrl: string): string {
  let dir = dirname(fileURLToPath(moduleUrl));
  for (;;) {
    if (readManifest(dir) !== undefined) return dir;
    const parent = dirname(dir);
    // the filesystem root is its own parent
    if (parent === dir) {
      throw new Error(`no package.json at or above ${moduleUrl}`);
    }
    dir = parent;
  }
}
