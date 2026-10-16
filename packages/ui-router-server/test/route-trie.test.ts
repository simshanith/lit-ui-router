import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compileRoutes } from '../src/redirects.ts';
import type { RouteDeclaration } from '../src/redirects.ts';
import { compileRouteTrie } from '../src/route-trie.ts';
import type {
  ParamType,
  UrlMatcherCompilerConfig,
} from '../src/url-matcher.ts';

const trieOf = (
  routes: RouteDeclaration[],
  config?: UrlMatcherCompilerConfig,
) => compileRouteTrie(compileRoutes(routes, config));

const slug: ParamType = {
  name: 'slug',
  pattern: /[a-z]+/,
  is: (val: unknown): val is string => typeof val === 'string',
  decode: (val) => val,
};

const anything: ParamType = { ...slug, name: 'anything', pattern: /.+/ };

describe('compileRouteTrie: expressibility', () => {
  const slashSpanning: [string, RouteDeclaration][] = [
    ['a catch-all', { name: 'r', url: '/files/*v' }],
    ['an inline string type', { name: 'r', url: '/s/{v:string}' }],
    ['an inline dot', { name: 'r', url: '/s/{v:.+}' }],
    ['a negated class without /', { name: 'r', url: '/s/{v:[^a]+}' }],
    ['a class whose range spans /', { name: 'r', url: '/s/{v:[!-z]+}' }],
    ['a matches-anything class', { name: 'r', url: '/s/{v:[\\s\\S]+}' }],
    ['a non-digit escape', { name: 'r', url: '/s/{v:\\D+}' }],
    ['an escaped slash', { name: 'r', url: '/s/{v:a\\/b}' }],
    ['a legacy octal escape', { name: 'r', url: '/s/{v:\\057}' }],
    ['a hex escape for /', { name: 'r', url: '/s/{v:\\x2f}' }],
    // Squash strings embed unchecked: `^/s/(a)|(b|[^/]*)?$` matches any url starting /s/a.
    [
      'a squash string that breaks out of its group',
      {
        name: 'r',
        url: '/s/:v',
        params: { v: { value: 'x', squash: 'a)|(b' } },
      },
    ],
    [
      'a declared string type',
      { name: 'r', url: '/s/:v', params: { v: { type: 'string' } } },
    ],
    [
      'a custom type that matches /',
      { name: 'r', url: '/s/:v', params: { v: { type: anything } } },
    ],
    [
      'a squash string that matches /',
      { name: 'r', url: '/s/:v', params: { v: { value: 'x', squash: '.*' } } },
    ],
  ];

  for (const [label, route] of slashSpanning) {
    it(`leaves out ${label}`, () => {
      const trie = trieOf([route]);

      assert.equal(trie.inexpressible.length, 1);
      assert.equal(trie.inexpressible[0].reason, 'slash-spanning-param');
      assert.equal(trie.inexpressible[0].param, 'v');
      assert.equal(trie.inexpressible[0].route.name, 'r');
    });
  }

  const expressible: [string, RouteDeclaration][] = [
    ['a path param', { name: 'r', url: '/s/:v' }],
    [
      'the int, bool and date types',
      { name: 'r', url: '/{a:int}/{b:bool}/{c:date}' },
    ],
    ['a hex class', { name: 'r', url: '/s/{v:[0-9a-fA-F]{1,8}}' }],
    ['a negated class containing /', { name: 'r', url: '/s/{v:[^/]+}' }],
    ['escaped dots', { name: 'r', url: '/v/{v:\\d+\\.\\d+}' }],
    ['alternation and groups', { name: 'r', url: '/v/{v:(?:ab|cd)\\b}' }],
    [
      'a custom type confined to a segment',
      { name: 'r', url: '/s/:v', params: { v: { type: slug } } },
    ],
    [
      'a squash string',
      { name: 'r', url: '/s/:v', params: { v: { value: 'x', squash: '~' } } },
    ],
    ['search params of any type', { name: 'r', url: '/s?{q:string}&rest' }],
  ];

  for (const [label, route] of expressible) {
    it(`expresses ${label}`, () => {
      assert.deepEqual(trieOf([route]).inexpressible, []);
    });
  }

  it('leaves out every route of a case-insensitive compiler', () => {
    const trie = trieOf([{ name: 'r', url: '/a' }], { caseInsensitive: true });

    assert.equal(trie.inexpressible.length, 1);
    assert.equal(trie.inexpressible[0].reason, 'case-insensitive');
    assert.equal(trie.match('/A'), null);
  });

  it('never matches a route it left out', () => {
    const trie = trieOf([
      { name: 'files', url: '/files/*rest' },
      { name: 'file', url: '/files/:id' },
    ]);

    assert.equal(trie.match('/files/a/b'), null);
    assert.deepEqual(trie.match('/files/a'), {
      state: 'file',
      params: { id: 'a' },
    });
  });

  it('skips url-less states', () => {
    const trie = trieOf([{ name: 'app' }, { name: 'app.home', url: '/home' }]);

    assert.deepEqual(trie.match('/home'), { state: 'app.home', params: {} });
  });
});

describe('compileRouteTrie: matching', () => {
  const trie = trieOf([
    { name: 'contacts', url: '/contacts' },
    { name: 'contacts.detail', url: '/:contactId' },
    { name: 'contacts.new', url: '/new' },
    { name: 'contacts.detail.edit', url: '/edit' },
  ]);

  it('extracts params', () => {
    assert.deepEqual(trie.match('/contacts/3'), {
      state: 'contacts.detail',
      params: { contactId: '3' },
    });
    assert.deepEqual(trie.match('/contacts/3/edit'), {
      state: 'contacts.detail.edit',
      params: { contactId: '3' },
    });
  });

  it('prefers a static segment over a param', () => {
    assert.deepEqual(trie.match('/contacts/new'), {
      state: 'contacts.new',
      params: {},
    });
  });

  it('returns null when nothing matches', () => {
    assert.equal(trie.match('/nope'), null);
    assert.equal(trie.match(''), null);
    assert.equal(trie.match('/contacts/3/edit/more'), null);
  });

  it('orders by compare, not declaration order', () => {
    const ordered = trieOf([
      { name: 'dynamicFirst', url: '/:x/b' },
      { name: 'staticFirst', url: '/a/:y' },
    ]);

    assert.equal(ordered.match('/a/b')?.state, 'staticFirst');
  });

  it('keeps the earlier declaration on a compare tie', () => {
    const tied = trieOf([
      { name: 'first', url: '/:a/:b' },
      { name: 'second', url: '/:c/:d' },
    ]);

    assert.equal(tied.match('/x/y')?.state, 'first');
  });

  it('confirms typed params by exec', () => {
    const typed = trieOf([{ name: 'n', url: '/n/{id:int}' }]);

    assert.deepEqual(typed.match('/n/7'), { state: 'n', params: { id: 7 } });
    assert.equal(typed.match('/n/x'), null);
  });

  it('matches params that share a segment with static text', () => {
    const partial = trieOf([{ name: 'v', url: '/v/:major.:minor.json' }]);

    assert.deepEqual(partial.match('/v/1.2.json'), {
      state: 'v',
      params: { major: '1', minor: '2' },
    });
    assert.equal(partial.match('/v/1/2.json'), null);
  });
});

describe('compileRouteTrie: trailing slashes', () => {
  const routes: RouteDeclaration[] = [
    { name: 'hello', url: '/hello' },
    { name: 'user', url: '/user/:id' },
  ];

  it('rejects a trailing slash under strict (the default)', () => {
    const trie = trieOf(routes);

    assert.equal(trie.match('/hello/'), null);
    assert.equal(trie.match('/user/7/'), null);
  });

  it('accepts one trailing slash when not strict', () => {
    const trie = trieOf(routes, { strict: false });

    assert.equal(trie.match('/hello/')?.state, 'hello');
    assert.deepEqual(trie.match('/user/7/'), {
      state: 'user',
      params: { id: '7' },
    });
    assert.equal(trie.match('/hello//'), null);
  });
});

describe('compileRouteTrie: squashed params', () => {
  const trie = trieOf([
    {
      name: 'docs',
      url: '/docs/:section/:page',
      params: {
        section: { value: 'intro', squash: true },
        page: { value: '1', squash: true },
      },
    },
  ]);

  it('matches with and without each squashed segment', () => {
    assert.deepEqual(trie.match('/docs'), {
      state: 'docs',
      params: { section: 'intro', page: '1' },
    });
    assert.deepEqual(trie.match('/docs/setup'), {
      state: 'docs',
      params: { section: 'setup', page: '1' },
    });
    assert.deepEqual(trie.match('/docs/setup/2'), {
      state: 'docs',
      params: { section: 'setup', page: '2' },
    });
    assert.equal(trie.match('/docs/setup/2/3'), null);
  });
});
