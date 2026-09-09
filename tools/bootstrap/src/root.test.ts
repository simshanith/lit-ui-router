// The depth arithmetic, checked against a file only the real root has. A move
// of this package (or of `src/`) changes the answer silently otherwise: every
// consumer still imports fine and every path built from it is merely wrong.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { describe, it } from 'node:test';

import { readManifest } from './manifest.ts';
import { workspaceRoot } from './root.ts';

describe('workspaceRoot', () => {
  it('is the directory holding pnpm-workspace.yaml', () => {
    assert.ok(isAbsolute(workspaceRoot));
    assert.ok(existsSync(join(workspaceRoot, 'pnpm-workspace.yaml')));
  });

  it('is the root member, not this package', () => {
    assert.equal(readManifest(workspaceRoot)?.name, 'lit-ui-router-turborepo');
  });
});
