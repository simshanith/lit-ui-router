// The one axis the type system can't see: what is actually on disk. TS cannot
// enumerate a directory, so this is the runtime half of the pin embeds.test-d.ts
// makes at compile time. An example directory missing from embeds.ts is never
// built, never typechecked and never seeded with node_modules by postinstall —
// it rots silently, so fail the build instead.
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { EXAMPLE_NAMES } from './embeds.ts';

const root = dirname(fileURLToPath(import.meta.url));

/** Directories under examples/ that are examples: the tutorials, not the workspace member. */
function exampleDirs(): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
    .filter((entry) => {
      try {
        return statSync(join(root, entry.name, 'package.json')).isFile();
      } catch {
        return false;
      }
    })
    .map((entry) => entry.name)
    .sort();
}

describe('embeds manifest', () => {
  it('declares every example directory, and no others', () => {
    assert.deepEqual(exampleDirs(), [...EXAMPLE_NAMES].sort());
  });
});
