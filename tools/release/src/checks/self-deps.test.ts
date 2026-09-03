import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatUndeclared, undeclaredMembers } from './self-deps.core.ts';

describe('undeclaredMembers', () => {
  const deps = ['^build', 'lit-ui-router#build', 'lit-ui-router-mobx#build'];

  it('passes when every publishable member has a #build edge', () => {
    assert.deepEqual(
      undeclaredMembers(['lit-ui-router', 'lit-ui-router-mobx'], deps),
      [],
    );
  });

  it('reports undeclared members sorted', () => {
    assert.deepEqual(
      undeclaredMembers(
        ['ui-router-navigation-location-plugin', 'lit-ui-router', 'a-new-pkg'],
        deps,
      ),
      ['a-new-pkg', 'ui-router-navigation-location-plugin'],
    );
  });

  it('does not count a non-build edge or the ^build wildcard', () => {
    assert.deepEqual(
      undeclaredMembers(['lit-ui-router'], ['^build', 'lit-ui-router#test']),
      ['lit-ui-router'],
    );
  });
});

describe('formatUndeclared', () => {
  it('names the packages and the turbo edge fix', () => {
    const text = formatUndeclared(['a-new-pkg']);
    assert.match(text, /a-new-pkg/);
    assert.match(text, /"a-new-pkg#build"/);
    assert.match(text, /stale cached verdicts/);
  });
});
