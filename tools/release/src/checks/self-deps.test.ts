import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatUndeclared, undeclaredMembers } from './self-deps.core.ts';

describe('undeclaredMembers', () => {
  const manifest = {
    name: '@tools/release',
    dependencies: { 'lit-ui-router': 'workspace:*' },
    devDependencies: { 'lit-ui-router-mobx': 'workspace:*' },
  };

  it('passes when every publishable member is declared in any dep field', () => {
    assert.deepEqual(
      undeclaredMembers(['lit-ui-router', 'lit-ui-router-mobx'], manifest),
      [],
    );
  });

  it('reports undeclared members sorted', () => {
    assert.deepEqual(
      undeclaredMembers(
        ['ui-router-navigation-location-plugin', 'lit-ui-router', 'a-new-pkg'],
        manifest,
      ),
      ['a-new-pkg', 'ui-router-navigation-location-plugin'],
    );
  });

  it('treats a manifest with no dep fields as declaring nothing', () => {
    assert.deepEqual(undeclaredMembers(['lit-ui-router'], {}), [
      'lit-ui-router',
    ]);
  });
});

describe('formatUndeclared', () => {
  it('names the packages and the devDependency fix', () => {
    const text = formatUndeclared(['a-new-pkg']);
    assert.match(text, /a-new-pkg/);
    assert.match(text, /"workspace:\*" devDependency/);
    assert.match(text, /stale cached verdicts/);
  });
});
