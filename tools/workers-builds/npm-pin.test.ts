// cloudflare-build.ts restates the mise npm pin, since nothing in the build
// image reads TOML before `pnpm install`. Assert the two agree.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { taploGet } from '@tools/shared/taplo.ts';
import { NPM_VERSION } from './cloudflare-build.ts';

describe('npm version pin', () => {
  it('installs the mise npm in Workers Builds', () => {
    assert.equal(
      NPM_VERSION,
      taploGet('.config/mise/config.toml', 'tools."npm:npm"'),
    );
  });
});
