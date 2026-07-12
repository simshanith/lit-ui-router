import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  memberDir,
  packageFromRef,
  resolvePackageName,
} from './release-package-info.core.ts';
import type { Member } from './workspace.ts';

const members: Member[] = [
  { name: 'lit-ui-router-monorepo', dir: '<root>' },
  { name: 'lit-ui-router', dir: 'packages/lit-ui-router' },
  { name: 'lit-ui-router-mobx', dir: 'packages/lit-ui-router-mobx' },
  {
    name: 'ui-router-navigation-location-plugin',
    dir: 'packages/navigation-location-plugin',
  },
];

describe('packageFromRef', () => {
  it('strips refs/tags/ and the @version suffix, like ${TAG%@*}', () => {
    assert.equal(
      packageFromRef('refs/tags/lit-ui-router@1.8.0'),
      'lit-ui-router',
    );
    assert.equal(
      packageFromRef('refs/tags/lit-ui-router-mobx@0.3.2'),
      'lit-ui-router-mobx',
    );
  });

  it('splits at the LAST @ so scoped names and prerelease tags survive', () => {
    assert.equal(packageFromRef('refs/tags/@scope/pkg@1.0.0'), '@scope/pkg');
    assert.equal(
      packageFromRef('refs/tags/lit-ui-router@1.0.3-alpha.0'),
      'lit-ui-router',
    );
  });

  it('passes an @-less tag through whole, matching the bash fallthrough', () => {
    assert.equal(packageFromRef('refs/tags/v1.2.3'), 'v1.2.3');
  });

  it('rejects non-tag refs', () => {
    assert.throws(() => packageFromRef('refs/heads/main'), /not a tag ref/);
    assert.throws(() => packageFromRef(''), /not a tag ref/);
    assert.throws(() => packageFromRef('refs/tags/'), /empty tag/);
  });

  // Refname hostility: git allows these tag names, and anyone with push
  // rights controls them. They must come back as inert strings — no shell
  // ever re-parses them — and then fail member resolution below.
  it('returns hostile refnames verbatim as inert strings', () => {
    assert.equal(
      packageFromRef('refs/tags/$(touch pwned)@1.0.0'),
      '$(touch pwned)',
    );
    assert.equal(packageFromRef('refs/tags/`id`@1.0.0'), '`id`');
    // git forbids spaces in refnames, but nothing here should rely on that
    assert.equal(
      packageFromRef('refs/tags/a b; rm -rf @1.0.0'),
      'a b; rm -rf ',
    );
    assert.equal(packageFromRef('refs/tags/&&curl evil@1.0.0'), '&&curl evil');
    assert.equal(packageFromRef('refs/tags/$HOME@1.0.0'), '$HOME');
  });
});

describe('resolvePackageName', () => {
  it('prefers the dispatch input when present (required:true on dispatch)', () => {
    assert.equal(
      resolvePackageName({
        packageInput: 'lit-ui-router',
        ref: 'refs/tags/other@1.0.0',
      }),
      'lit-ui-router',
    );
  });

  it('falls back to the tag ref on push events', () => {
    assert.equal(
      resolvePackageName({
        packageInput: undefined,
        ref: 'refs/tags/lit-ui-router@1.8.0',
      }),
      'lit-ui-router',
    );
    assert.equal(
      resolvePackageName({
        packageInput: '',
        ref: 'refs/tags/lit-ui-router@1.8.0',
      }),
      'lit-ui-router',
    );
  });

  it('fails loudly when neither source is set', () => {
    assert.throws(
      () => resolvePackageName({ packageInput: '', ref: undefined }),
      /neither PACKAGE_INPUT nor GITHUB_REF/,
    );
  });
});

describe('memberDir', () => {
  it('maps a package name to its workspace-relative directory', () => {
    assert.equal(memberDir('lit-ui-router', members), 'packages/lit-ui-router');
    assert.equal(
      memberDir('ui-router-navigation-location-plugin', members),
      'packages/navigation-location-plugin',
    );
  });

  it('never resolves to the workspace root', () => {
    assert.throws(
      () => memberDir('lit-ui-router-monorepo', members),
      /not a workspace member/,
    );
  });

  it('is the backstop that rejects hostile tag-derived names', () => {
    for (const hostile of [
      '$(touch pwned)',
      '`id`',
      'a b; rm -rf ',
      '&&curl evil',
      '$HOME',
      'not-a-member',
    ]) {
      assert.throws(
        () => memberDir(hostile, members),
        /not a workspace member/,
      );
    }
  });
});
