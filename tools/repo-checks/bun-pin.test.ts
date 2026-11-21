// mise pins the bun that parses the mise config for the Workers Builds
// bootstrap (tools/workers-builds/bun/), every trigger sets BUN_VERSION to it
// (workers-builds-triggers.test.ts holds that pair), and @types/bun types the
// script against the same release. Assert the catalog agrees with mise.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { loadWorkspaceManifest } from '@tools/shared/workspace.ts';
import { taploGet } from './cli-query.ts';

describe('bun version pins', () => {
  it('pins @types/bun in the catalog to the mise bun', async () => {
    const manifest = await loadWorkspaceManifest(workspaceRoot);

    assert.equal(
      manifest?.catalog?.['@types/bun'],
      taploGet('.config/mise/config.toml', 'tools."aqua:oven-sh/bun"'),
    );
  });
});
