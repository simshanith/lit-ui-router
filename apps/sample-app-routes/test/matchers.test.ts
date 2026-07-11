import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compileAppPattern } from '../src/matchers.ts';

// Regression net for the $injector shim: without it, core routes even static
// param defaults through the (absent) injector and exec() throws "Injectable
// functions cannot be called at configuration time".
describe('compileAppPattern without a framework injector', () => {
  it('matches query-suffixed patterns without throwing', () => {
    const matcher = compileAppPattern('/welcome?flag');
    assert.notEqual(matcher.exec('/welcome'), null);
    assert.equal(matcher.exec('/nope'), null);
  });

  it('applies defaulted params without throwing', () => {
    const matcher = compileAppPattern('/x/:id', {
      params: { id: { value: 'fallback', squash: true } },
    });
    const defaulted = matcher.exec('/x') as Record<string, string> | null;
    assert.equal(defaulted?.id, 'fallback');
    const explicit = matcher.exec('/x/7') as Record<string, string> | null;
    assert.equal(explicit?.id, '7');
    assert.equal(matcher.exec('/y'), null);
  });

  // A bare UrlMatcher defaults caseInsensitive to true; the factory (and so
  // the client router) defaults it to false. Guard the explicit override.
  it('stays case-sensitive and strict like the factory', () => {
    const matcher = compileAppPattern('/welcome');
    assert.equal(matcher.exec('/WELCOME'), null);
    assert.equal(matcher.exec('/welcome/extra'), null);
  });
});
