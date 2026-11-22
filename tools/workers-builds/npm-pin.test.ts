// cloudflare-build.ts restates the mise npm pin, since nothing in the build
// image reads TOML before `pnpm install`. Assert the two agree.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { NPM_VERSION } from './cloudflare-build.ts';

describe('npm version pin', () => {
  it('installs the mise npm in Workers Builds', () => {
    // taplo is the repo's mise-pinned TOML reader, as in tools/repo-checks.
    const pinned = execFileSync(
      'taplo',
      [
        'get',
        '-f',
        join(workspaceRoot, '.config/mise/config.toml'),
        'tools."npm:npm"',
      ],
      { encoding: 'utf8' },
    ).trim();

    assert.equal(NPM_VERSION, pinned);
  });
});
