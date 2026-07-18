import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compare,
  exec,
  format,
  urlMatcherFactory,
} from '../src/url-matcher.ts';

// Behavior specs for the standalone matcher on its own. Fidelity against
// @uirouter/core is asserted separately, case by case, by the differential
// suite (url-matcher.differential.test.ts).
const { compile } = urlMatcherFactory();

describe('factory defaults', () => {
  it('is strict about trailing slashes', () => {
    const matcher = compile('/welcome');
    assert.deepEqual(exec(matcher, '/welcome'), {});
    assert.equal(exec(matcher, '/welcome/'), null);
  });

  it('is case-sensitive', () => {
    assert.equal(exec(compile('/welcome'), '/Welcome'), null);
  });

  it('does not squash defaulted params', () => {
    const matcher = compile('/x/:id', { params: { id: 'fallback' } });
    assert.equal(exec(matcher, '/x'), null);
    assert.deepEqual(exec(matcher, '/x/'), { id: 'fallback' });
  });

  it('overrides per compile', () => {
    assert.deepEqual(
      exec(compile('/welcome', { strict: false }), '/welcome/'),
      {},
    );
    assert.deepEqual(
      exec(compile('/welcome', { caseInsensitive: true }), '/WELCOME'),
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
    assert.deepEqual(exec(matcher, '/welcome'), { flag: undefined });
    assert.equal(exec(matcher, '/nope'), null);
  });

  it('applies defaulted params without throwing', () => {
    const matcher = compile('/x/:id', {
      params: { id: { value: 'fallback', squash: true } },
    });
    assert.deepEqual(exec(matcher, '/x'), { id: 'fallback' });
    assert.deepEqual(exec(matcher, '/x/'), { id: 'fallback' });
    assert.deepEqual(exec(matcher, '/x/7'), { id: '7' });
    assert.equal(exec(matcher, '/y'), null);
  });

  it('applies typed defaults', () => {
    const matcher = compile('/page/{num:int}', {
      params: { num: { value: 1, squash: true } },
    });
    assert.deepEqual(exec(matcher, '/page'), { num: 1 });
    assert.deepEqual(exec(matcher, '/page/3'), { num: 3 });
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
      () => exec(compile('/u/{id:(a|b)}'), '/u/a'),
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
    assert.deepEqual(exec(matcher, '/tag/ABC'), { tag: 'ABC' });
    assert.equal(exec(matcher, '/tag/abc'), null);
  });
});

describe('format', () => {
  it('builds a url from param values, percent-encoding them', () => {
    const matcher = compile('/user/:id?q');
    assert.equal(
      format(matcher, { id: 'b ob', q: 'a&b' }),
      '/user/b%20ob?q=a%26b',
    );
    assert.equal(format(matcher, { id: 'bob' }), '/user/bob');
  });

  it('returns null when a value fails its type', () => {
    const matcher = compile('/user/{id:int}');
    assert.equal(format(matcher, { id: 'abc' }), null);
    assert.equal(format(matcher, {}), null);
    assert.equal(format(matcher, { id: 42 }), '/user/42');
  });

  it('squashes defaulted params per policy', () => {
    const params = (squash: boolean | string) => ({
      params: { id: { value: 'fallback', squash } },
    });
    assert.equal(format(compile('/x/:id', params(true)), {}), '/x');
    assert.equal(format(compile('/x/:id', params(false)), {}), '/x/fallback');
    assert.equal(format(compile('/x/:id', params('~')), {}), '/x/~');
    assert.equal(format(compile('/x/:id', params(true)), { id: '7' }), '/x/7');
  });

  it('omits absent search params and appends a hash fragment', () => {
    const matcher = compile('/search?q&r');
    assert.equal(format(matcher, {}), '/search');
    assert.equal(format(matcher, { q: 'a' }), '/search?q=a');
    assert.equal(format(matcher, { q: 'a', '#': 'frag' }), '/search?q=a#frag');
  });

  it('round-trips exec', () => {
    const matcher = compile('/mymessages/:folderId/{messageId:int}');
    const params = { folderId: 'inbox', messageId: 5 };
    const url = format(matcher, params);
    assert.equal(url, '/mymessages/inbox/5');
    assert.deepEqual(exec(matcher, url as string), params);
  });
});

describe('compiled matcher surface', () => {
  it('exposes the source pattern', () => {
    const matcher = compile('/user/:id');
    assert.equal(matcher.pattern, '/user/:id');
  });

  it('freezes the compiled matcher and its arrays', () => {
    const matcher = compile('/user/:id?q');
    assert.ok(Object.isFrozen(matcher));
    assert.ok(Object.isFrozen(matcher.segments));
    assert.ok(Object.isFrozen(matcher.pathParams));
    assert.ok(Object.isFrozen(matcher.searchParams));
  });

  it('carries typed compile-time meta on the matcher', () => {
    const matcher = compile('/user/:id', {}, { routeId: 'users.detail' });
    // Inferred as CompiledMatcher<{ routeId: string }> — .routeId typechecks.
    assert.equal(matcher.meta.routeId, 'users.detail');
    // The reference is frozen in; the meta object stays consumer-owned.
    assert.ok(!Object.isFrozen(matcher.meta));
    matcher.meta.routeId = 'renamed';
    assert.equal(matcher.meta.routeId, 'renamed');
  });

  it('defaults meta to undefined when not passed', () => {
    assert.equal(compile('/user/:id').meta, undefined);
  });

  it('operations ignore meta entirely', () => {
    const plain = compile('/user/:id');
    const tagged = compile('/user/:id', {}, { routeId: 'x' });
    assert.deepEqual(exec(tagged, '/user/7'), exec(plain, '/user/7'));
    assert.equal(format(tagged, { id: '7' }), format(plain, { id: '7' }));
    assert.equal(compare(tagged, plain), 0);
    // Twice: the second compare hits the WeakMap memo, same verdict.
    assert.equal(compare(tagged, plain), 0);
  });

  it('freezes each compiled param (deep, including replace)', () => {
    const matcher = compile('/x/:id', { params: { id: 'fallback' } });
    const param = matcher.pathParams[0];
    assert.ok(Object.isFrozen(param));
    assert.ok(Object.isFrozen(param.replace));
    assert.throws(() => {
      // @ts-expect-error -- readonly; the throw is the point
      param.squash = true;
    }, TypeError);
    assert.deepEqual(exec(matcher, '/x/'), { id: 'fallback' });
  });

  it('rejects mutation of a builtin param type (shared singleton)', () => {
    const matcher = compile('/page/{num:int}');
    const { type } = matcher.pathParams[0];
    assert.throws(() => {
      // @ts-expect-error -- readonly; the throw is the point
      type.decode = () => 'poisoned';
    }, TypeError);
  });

  it('cannot poison a matcher compiled after a mutation attempt', () => {
    const first = compile('/a/{num:int}');
    try {
      // @ts-expect-error -- readonly; sloppy-mode callers no-op instead
      first.pathParams[0].type.decode = () => 'poisoned';
    } catch {
      // strict mode: the assignment throws; either way the singleton is intact
    }
    const second = compile('/b/{num:int}');
    assert.deepEqual(exec(second, '/b/7'), { num: 7 });
    assert.deepEqual(exec(first, '/a/7'), { num: 7 });
  });
});
