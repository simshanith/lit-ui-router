import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { urlMatcherFactory } from '../src/url-matcher.ts';

// Behavior specs for the standalone matcher on its own. Fidelity against
// @uirouter/core is asserted separately, case by case, by the differential
// suite (url-matcher.differential.test.ts).
const { compile } = urlMatcherFactory();

describe('factory defaults', () => {
  it('is strict about trailing slashes', () => {
    const matcher = compile('/welcome');
    assert.deepEqual(matcher.exec('/welcome'), {});
    assert.equal(matcher.exec('/welcome/'), null);
  });

  it('is case-sensitive', () => {
    assert.equal(compile('/welcome').exec('/Welcome'), null);
  });

  it('does not squash defaulted params', () => {
    const matcher = compile('/x/:id', { params: { id: 'fallback' } });
    assert.equal(matcher.exec('/x'), null);
    assert.deepEqual(matcher.exec('/x/'), { id: 'fallback' });
  });

  it('overrides per compile', () => {
    assert.deepEqual(
      compile('/welcome', { strict: false }).exec('/welcome/'),
      {},
    );
    assert.deepEqual(
      compile('/welcome', { caseInsensitive: true }).exec('/WELCOME'),
      {},
    );
  });
});

describe('static param defaults without any $injector', () => {
  // Upstream routes even static defaults through services.$injector.invoke()
  // and throws "Injectable functions cannot be called at configuration time"
  // when no framework installed one. The extraction applies them directly.
  it('matches query-suffixed patterns without throwing', () => {
    const matcher = compile('/welcome?flag');
    assert.deepEqual(matcher.exec('/welcome'), { flag: undefined });
    assert.equal(matcher.exec('/nope'), null);
  });

  it('applies defaulted params without throwing', () => {
    const matcher = compile('/x/:id', {
      params: { id: { value: 'fallback', squash: true } },
    });
    assert.deepEqual(matcher.exec('/x'), { id: 'fallback' });
    assert.deepEqual(matcher.exec('/x/'), { id: 'fallback' });
    assert.deepEqual(matcher.exec('/x/7'), { id: '7' });
    assert.equal(matcher.exec('/y'), null);
  });

  it('applies typed defaults', () => {
    const matcher = compile('/page/{num:int}', {
      params: { num: { value: 1, squash: true } },
    });
    assert.deepEqual(matcher.exec('/page'), { num: 1 });
    assert.deepEqual(matcher.exec('/page/3'), { num: 3 });
  });
});

describe('explicit rejections (fail at compile, never diverge silently)', () => {
  it('rejects array params', () => {
    assert.throws(
      () => compile('/a/{ids[]}'),
      /Array parameters are not supported/,
    );
    assert.throws(
      () => compile('/a/:ids', { params: { ids: { array: true } } }),
      /Array parameters are not supported/,
    );
  });

  it('rejects function (injected) defaults', () => {
    assert.throws(
      () => compile('/a/:id', { params: { id: { value: () => 'x' } } }),
      /Function \(injected\) defaults are not supported/,
    );
  });

  it('rejects replace configs', () => {
    assert.throws(
      () => compile('/a/:id', { params: { id: { value: 'x', replace: [] } } }),
      /'replace' is not supported/,
    );
  });

  it('rejects the json, hash, and any types', () => {
    assert.throws(() => compile('/a/{x:json}'), /not supported/);
    assert.throws(() => compile('/a?{x:any}'), /not supported/);
    assert.throws(
      () => compile('/a/:x', { params: { x: { type: 'hash' } } }),
      /not supported/,
    );
  });

  it('rejects unknown type names', () => {
    assert.throws(
      () => compile('/a/:x', { params: { x: { type: 'uuid' } } }),
      /Unknown type 'uuid'/,
    );
  });

  it('rejects invalid squash policies', () => {
    assert.throws(
      () => compile('/a/:x', { params: { x: { value: 'v', squash: 5 } } }),
      /Invalid squash policy/,
    );
    assert.throws(
      () =>
        urlMatcherFactory({
          defaultSquashPolicy: 5 as unknown as boolean,
        }),
      /Invalid squash policy/,
    );
  });
});

describe('compile errors shared with upstream', () => {
  it('rejects duplicate param names', () => {
    assert.throws(() => compile('/a/:x/{x}'), /Duplicate parameter name 'x'/);
  });

  it('throws on inline regexps containing capture groups', () => {
    assert.throws(
      () => compile('/u/{id:(a|b)}').exec('/u/a'),
      /Unbalanced capture group/,
    );
  });
});

describe('custom ParamType objects', () => {
  it('accepts a type object in the param declaration', () => {
    const upper = {
      name: 'upper',
      pattern: /[A-Z]+/,
      is: (val: unknown) =>
        typeof val === 'string' && val === val.toUpperCase(),
      decode: (val: string) => val.toUpperCase(),
    };
    const matcher = compile('/tag/:tag', { params: { tag: { type: upper } } });
    assert.deepEqual(matcher.exec('/tag/ABC'), { tag: 'ABC' });
    assert.equal(matcher.exec('/tag/abc'), null);
  });
});

describe('format', () => {
  it('builds a url from param values, percent-encoding them', () => {
    const matcher = compile('/user/:id?q');
    assert.equal(
      matcher.format({ id: 'b ob', q: 'a&b' }),
      '/user/b%20ob?q=a%26b',
    );
    assert.equal(matcher.format({ id: 'bob' }), '/user/bob');
  });

  it('returns null when a value fails its type', () => {
    const matcher = compile('/user/{id:int}');
    assert.equal(matcher.format({ id: 'abc' }), null);
    assert.equal(matcher.format({}), null);
    assert.equal(matcher.format({ id: 42 }), '/user/42');
  });

  it('squashes defaulted params per policy', () => {
    const params = (squash: boolean | string) => ({
      params: { id: { value: 'fallback', squash } },
    });
    assert.equal(compile('/x/:id', params(true)).format({}), '/x');
    assert.equal(compile('/x/:id', params(false)).format({}), '/x/fallback');
    assert.equal(compile('/x/:id', params('~')).format({}), '/x/~');
    assert.equal(compile('/x/:id', params(true)).format({ id: '7' }), '/x/7');
  });

  it('omits absent search params and appends a hash fragment', () => {
    const matcher = compile('/search?q&r');
    assert.equal(matcher.format({}), '/search');
    assert.equal(matcher.format({ q: 'a' }), '/search?q=a');
    assert.equal(matcher.format({ q: 'a', '#': 'frag' }), '/search?q=a#frag');
  });

  it('round-trips exec', () => {
    const matcher = compile('/mymessages/:folderId/{messageId:int}');
    const params = { folderId: 'inbox', messageId: 5 };
    const url = matcher.format(params);
    assert.equal(url, '/mymessages/inbox/5');
    assert.deepEqual(matcher.exec(url as string), params);
  });
});

describe('UrlMatcher surface', () => {
  it('exposes the source pattern', () => {
    const matcher = compile('/user/:id');
    assert.equal(matcher.pattern, '/user/:id');
    assert.equal(String(matcher), '/user/:id');
  });
});
