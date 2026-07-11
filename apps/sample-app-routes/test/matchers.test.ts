import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UIRouter } from '@uirouter/core';

// Importing the matchers module installs its $injector shim.
import '../src/matchers.ts';

// Regression net for the shim: without it, core routes even static param
// defaults through the (absent) injector and exec() throws "Injectable
// functions cannot be called at configuration time".
describe('UrlMatcher exec without a framework injector', () => {
  const { urlMatcherFactory } = new UIRouter();

  it('matches query-suffixed patterns without throwing', () => {
    const matcher = urlMatcherFactory.compile('/welcome?flag');
    assert.notEqual(matcher.exec('/welcome'), null);
    assert.equal(matcher.exec('/nope'), null);
  });

  it('applies defaulted params without throwing', () => {
    const matcher = urlMatcherFactory.compile('/x/:id', {
      state: { params: { id: { value: 'fallback', squash: true } } },
    });
    const defaulted = matcher.exec('/x') as Record<string, string> | null;
    assert.equal(defaulted?.id, 'fallback');
    const explicit = matcher.exec('/x/7') as Record<string, string> | null;
    assert.equal(explicit?.id, '7');
    assert.equal(matcher.exec('/y'), null);
  });
});
