import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Member } from '@tools/shared/workspace.ts';
import { newlyTaggedPackages } from './release-new-tags.core.ts';

const members: Member[] = [
  { name: 'lit-ui-router', dir: '<root>', manifest: { version: '0.0.0' } },
  {
    name: 'lit-ui-router',
    dir: 'packages/lit-ui-router',
    manifest: { version: '1.8.0' },
  },
  {
    name: 'lit-ui-router-mobx',
    dir: 'packages/lit-ui-router-mobx',
    manifest: { version: '0.3.4' },
  },
  { name: 'docs', dir: 'docs', manifest: { private: true, version: '1.8.0' } },
  { name: 'unversioned', dir: 'tools/unversioned', manifest: {} },
];

describe('newlyTaggedPackages', () => {
  it('selects members whose <name>@<version> tag points at the commit', () => {
    assert.deepEqual(newlyTaggedPackages(members, ['lit-ui-router@1.8.0']), [
      'lit-ui-router',
    ]);
  });

  it('handles multi-package releases and raw git stdout lines', () => {
    assert.deepEqual(
      newlyTaggedPackages(members, [
        'lit-ui-router@1.8.0',
        'lit-ui-router-mobx@0.3.4',
        '', // trailing newline from git tag --points-at
      ]),
      ['lit-ui-router', 'lit-ui-router-mobx'],
    );
  });

  it('ignores stale tags, root, private, and unversioned members', () => {
    // an unbumped package's current-version tag points at an OLDER commit,
    // so it never appears in tagsAtCommit; a same-named tag for root or a
    // private member must not select a publish either
    assert.deepEqual(
      newlyTaggedPackages(members, [
        'lit-ui-router@1.7.9', // no member at this version
        'docs@1.8.0', // private
        'unversioned@', // never composable
      ]),
      [],
    );
  });

  it('returns empty for a no-release main push', () => {
    assert.deepEqual(newlyTaggedPackages(members, ['']), []);
  });
});
