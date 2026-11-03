import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { servicesPlugin, UIRouter } from '@uirouter/core';
import type { RawParams, StateDeclaration, StateRule } from '@uirouter/core';

import { createServerRouter } from '../src/index.ts';
import { serverLocationPlugin } from '../src/location.ts';
import { compileRoutes, matchRoute } from '../src/redirects.ts';
import type { RouteDeclaration } from '../src/redirects.ts';
import { compileRouteTrie } from '../src/route-trie.ts';
import { onceSettled } from '../src/simulate.ts';
import {
  isUrlPatternUrl,
  matcherPath,
  urlPattern,
  urlPatternPlugin,
} from '../src/url-pattern.ts';
import type { UrlPatternOptions } from '../src/url-pattern.ts';

// Core types StateDeclaration.url as string; a urlPattern() value rides the same field.
const url = (pathname: string, options?: UrlPatternOptions): string =>
  // SAFETY: the plugin's builder and compileRoutes read a urlPattern() value back from core's string-typed url field.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- core's url field is string-typed; the plugin and compileRoutes read the value back
  urlPattern(pathname, options) as unknown as string;

// One factory per router: core mutates registrations ($$state).
const table = (): RouteDeclaration[] => [
  { name: 'home', url: url('/') },
  { name: 'users', url: url('/users', { query: ['sort'] }) },
  {
    name: 'users.detail',
    url: url('/:id'),
    params: { id: { type: 'int' } },
  },
  { name: 'users.detail.edit', url: url('/edit') },
  { name: 'users.new', url: url('/new') },
  { name: 'files', url: url('/files/:dir/:name.:ext') },
  { name: 'codes', url: url('/codes/:code([a-z]{3})') },
  { name: 'slug', url: url('/by/:slug') },
];

const routerFor = (states: StateDeclaration[] = table()): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(serverLocationPlugin);
  router.plugin(urlPatternPlugin);
  router.stateService.defaultErrorHandler(() => {});
  states.forEach((state) => router.stateRegistry.register(state));

  return router;
};

const coreMatch = (
  router: UIRouter,
  path: string,
  search: RawParams = {},
): { state: string; params: RawParams } | null => {
  const matched = router.urlService.match({ path, search, hash: '' });

  if (!matched) return null;
  // SAFETY: every rule in these routers is a state's url rule.
  const { state } = matched.rule as StateRule;

  // SAFETY: a state rule's match is its matcher's RawParams.
  return { state: state.name, params: matched.match as RawParams };
};

describe('urlPattern', () => {
  it('accepts the formattable subset and translates it to matcher syntax', () => {
    const declared = urlPattern('/files/:dir/:name.:ext', { query: ['q'] });
    assert.ok(isUrlPatternUrl(declared));
    assert.deepEqual(declared.query, ['q']);
    assert.equal(
      matcherPath(declared),
      '/files/{dir:[^/]+?}/{name:[^/]+?}.{ext:[^/]+?}',
    );
    assert.equal(
      matcherPath(urlPattern('/codes/:code([a-z]{3})')),
      '/codes/{code:(?:[a-z]{3})}',
    );
    assert.equal(
      matcherPath(urlPattern('/users/:id'), { id: { type: 'int' } }),
      '/users/:id',
    );
  });

  it('rejects a group with both a regexp and a declared type', () => {
    assert.throws(
      () =>
        matcherPath(urlPattern('/users/:id(\\d+)'), { id: { type: 'int' } }),
      /group ':id' takes a regexp or a declared type, not both/,
    );
  });

  it('accepts a URLPattern whose other components are wildcards', () => {
    const declared = urlPattern(new URLPattern({ pathname: '/users/:id' }));
    assert.equal(declared.pathname, '/users/:id');
  });

  for (const [pathname, reason] of [
    ['/files/*', /'\*' at index 7 is outside the supported subset/],
    ['/users/:id?', /modifier '\?' at index 10/],
    ['/users/:id+', /modifier '\+'/],
    ['/users/(\\d+)', /'\(' at index 7/],
    ['/users{/:id}?', /'\{' at index 6/],
    ['/users/\\:id', /literal '\/users\/:id' has no matcher spelling/],
  ] as const)
    it(`rejects ${pathname}`, () => {
      assert.throws(() => urlPattern(pathname), reason);
    });

  it('rejects components other than pathname', () => {
    assert.throws(
      () => urlPattern({ pathname: '/users', search: 'sort=:sort' }),
      /component 'search' must be absent or '\*'/,
    );
    assert.throws(
      () => urlPattern(new URLPattern({ pathname: '/a', hostname: 'x.test' })),
      /component 'hostname'/,
    );
  });

  it('rejects relative pathnames', () => {
    assert.throws(() => urlPattern('users'), /must start with '\/'/);
  });
});

describe('urlPatternPlugin in a @uirouter/core router', () => {
  it('builds urls core accepts as matchers', () => {
    const router = routerFor();

    const { url: matcher } =
      router.stateRegistry.get('users.detail').$$state!();

    // oxlint-disable-next-line typescript/no-deprecated -- isMatcher is the check core's state builder runs
    assert.ok(router.urlMatcherFactory.isMatcher(matcher));
    assert.equal(matcher.toString(), '/users/:id?sort');
  });

  it('matches with URLPattern, nesting children under the parent pathname', () => {
    const router = routerFor();
    assert.deepEqual(coreMatch(router, '/'), { state: 'home', params: {} });
    assert.deepEqual(coreMatch(router, '/users', { sort: 'name' }), {
      state: 'users',
      params: { sort: 'name' },
    });
    assert.deepEqual(coreMatch(router, '/users/42/edit'), {
      state: 'users.detail.edit',
      params: { id: 42, sort: undefined },
    });
    assert.deepEqual(coreMatch(router, '/files/docs/a.b.c'), {
      state: 'files',
      params: { dir: 'docs', name: 'a', ext: 'b.c' },
    });
    assert.deepEqual(coreMatch(router, '/by/a%20b'), {
      state: 'slug',
      params: { slug: 'a b' },
    });
    assert.equal(coreMatch(router, '/users/abc'), null);
    assert.equal(coreMatch(router, '/codes/abcd'), null);
    assert.equal(coreMatch(router, '/users/42/'), null);
  });

  it("sorts with core's specificity: a static segment beats a group", () => {
    const router = routerFor();
    assert.equal(coreMatch(router, '/users/new')?.state, 'users.new');
  });

  it('formats hrefs, null for values the pattern or type rejects', () => {
    const { stateService } = routerFor();
    assert.equal(stateService.href('users.detail', { id: 7 }), '/users/7');
    assert.equal(
      stateService.href('users.detail.edit', { id: 7, sort: 'name' }),
      '/users/7/edit?sort=name',
    );
    assert.equal(stateService.href('slug', { slug: 'a b' }), '/by/a%20b');
    assert.equal(stateService.href('codes', { code: 'abc' }), '/codes/abc');
    assert.equal(stateService.href('codes', { code: 'abcd' }), null);
    assert.equal(stateService.href('users.detail', { id: 'x' }), null);
  });

  it('transitions from a url with typed params', async () => {
    const router = routerFor();
    const settled = onceSettled(router);
    router.urlService.url('/users/42?sort=name');
    router.urlService.sync();
    assert.ok(await settled);
    const { current, params } = router.globals;
    assert.equal(current.name, 'users.detail');
    assert.equal(params.id, 42);
    assert.equal(params.sort, 'name');
  });

  it('honors non-strict and case-insensitive url config', () => {
    const router = new UIRouter();
    router.urlService.config.strictMode(false);
    router.urlService.config.caseInsensitive(true);
    router.plugin(urlPatternPlugin);
    router.stateRegistry.register({ name: 'users', url: url('/users') });
    assert.equal(coreMatch(router, '/USERS/')?.state, 'users');
  });

  it("leaves string urls to core's builder", () => {
    const router = routerFor([
      { name: 'legacy', url: '/legacy/{id:int}' },
      { name: 'modern', url: url('/modern/:id') },
    ]);

    assert.deepEqual(coreMatch(router, '/legacy/3'), {
      state: 'legacy',
      params: { id: 3 },
    });
    assert.equal(router.stateService.href('modern', { id: 'x' }), '/modern/x');
  });

  it('rejects a URLPattern child under a string url', () => {
    assert.throws(
      () =>
        routerFor([
          { name: 'a', url: '/a' },
          { name: 'a.b', url: url('/b') },
        ]),
      /State 'a.b': URLPattern url '\/b' can't extend string url '\/a'/,
    );
  });

  it('rejects a string child under a URLPattern url', () => {
    assert.throws(
      () =>
        routerFor([
          { name: 'a', url: url('/a') },
          { name: 'a.b', url: '/b' },
        ]),
      /String url '\/b' can't extend URLPattern url '\/a'/,
    );
  });

  it('rejects a group with both a regexp and a declared type', () => {
    assert.throws(
      () =>
        routerFor([
          {
            name: 'a',
            url: url('/a/:id(\\d+)'),
            params: { id: { type: 'int' } },
          },
        ]),
      /State 'a': URLPattern group ':id' takes a regexp or a declared type, not both/,
    );
  });

  it('rejects defaults and arrays on path groups', () => {
    assert.throws(
      () => routerFor([{ name: 'a', url: url('/a/:id'), params: { id: 'x' } }]),
      /group ':id' is required, so it can't declare a default/,
    );
    assert.throws(
      () =>
        routerFor([
          { name: 'a', url: url('/a/:id'), params: { id: { array: true } } },
        ]),
      /group ':id' can't be an array param/,
    );
  });

  it('names the state when the engine rejects the joined pattern', () => {
    assert.throws(
      () =>
        routerFor([
          { name: 'a', url: url('/a/:id') },
          { name: 'a.b', url: url('/b/:id') },
        ]),
      /^Error: State 'a\.b': /,
    );
  });
});

describe('server tiers over urlPattern routes', () => {
  const paths: [string, RawParams?][] = [
    ['/'],
    ['/users'],
    ['/users/42'],
    ['/users/42/edit'],
    ['/users/new'],
    ['/users/abc'],
    ['/files/docs/a.b.c'],
    ['/codes/abc'],
    ['/codes/abcd'],
    ['/by/a%20b'],
    ['/by/'],
    ['/nope'],
  ];

  it("the matcher strategy's compiled routes agree with the URLPattern engine", () => {
    const router = routerFor();
    const routes = compileRoutes(table());
    const trie = compileRouteTrie(routes);
    assert.deepEqual(trie.inexpressible, []);

    for (const [path] of paths) {
      const engine = coreMatch(router, path);
      const scanned = matchRoute(routes, path);
      assert.deepEqual(scanned, engine, path);
      assert.deepEqual(trie.match(path), engine, path);
    }
  });

  for (const strategy of ['matcher', 'simulate'] as const)
    it(`resolves verdicts with the ${strategy} strategy`, async () => {
      const server = createServerRouter({
        mounts: { '/app': { routes: table(), strategy } },
      });

      assert.deepEqual(await server.resolve('/app/users/42/edit'), {
        kind: 'shell',
        mount: '/app',
      });
      assert.equal((await server.resolve('/app/users/abc')).kind, 'notFound');
    });
});
