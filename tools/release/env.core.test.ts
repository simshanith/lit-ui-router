import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { boolEnv, requireEnv } from './env.core.ts';

describe('requireEnv', () => {
  it('returns the trimmed value', () => {
    assert.equal(
      requireEnv({ PACKAGE: ' lit-ui-router ' }, 'PACKAGE'),
      'lit-ui-router',
    );
  });

  it('names the missing variable', () => {
    assert.throws(() => requireEnv({}, 'PACKAGE_NAME'), /PACKAGE_NAME/);
  });

  it('treats blank as missing', () => {
    assert.throws(() => requireEnv({ TARBALL: '   ' }, 'TARBALL'), /TARBALL/);
  });
});

describe('boolEnv', () => {
  it("only the exact string 'true' enables", () => {
    assert.equal(boolEnv({ DRY_RUN: 'true' }, 'DRY_RUN'), true);
    assert.equal(boolEnv({ DRY_RUN: ' true ' }, 'DRY_RUN'), true);
  });

  it('false, empty, unset, and junk all disable', () => {
    // '' is what `${{ inputs.dryRun }}` renders on a tag-push event
    assert.equal(boolEnv({ DRY_RUN: 'false' }, 'DRY_RUN'), false);
    assert.equal(boolEnv({ DRY_RUN: '' }, 'DRY_RUN'), false);
    assert.equal(boolEnv({}, 'DRY_RUN'), false);
    assert.equal(boolEnv({ DRY_RUN: '1' }, 'DRY_RUN'), false);
    assert.equal(boolEnv({ DRY_RUN: 'TRUE' }, 'DRY_RUN'), false);
  });
});
