import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pushTagArgs, releaseTagName } from './release-tag-push.core.ts';

describe('releaseTagName', () => {
  it('composes the repo tag convention <package>@<version>', () => {
    assert.equal(
      releaseTagName('lit-ui-router', '1.8.0'),
      'lit-ui-router@1.8.0',
    );
    assert.equal(
      releaseTagName('lit-ui-router', '1.0.3-alpha.0'),
      'lit-ui-router@1.0.3-alpha.0',
    );
  });

  it('refuses to compose half-formed refs', () => {
    assert.throws(() => releaseTagName('', '1.0.0'), /packageName/);
    // a manifest with no version field must not push refs/tags/pkg@
    assert.throws(() => releaseTagName('pkg', ''), /invalid version/);
    assert.throws(() => releaseTagName('pkg', '1.0 .0'), /invalid version/);
  });
});

describe('pushTagArgs', () => {
  it('pushes exactly the tag ref, never a branch', () => {
    assert.deepEqual(pushTagArgs('lit-ui-router@1.8.0'), [
      'push',
      'origin',
      'refs/tags/lit-ui-router@1.8.0',
    ]);
  });
});
