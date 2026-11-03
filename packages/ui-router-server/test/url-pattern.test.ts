import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { servicesPlugin, UIRouter } from '@uirouter/core';
import type {
  ParamType,
  RawParams,
  StateDeclaration,
  StateRule,
} from '@uirouter/core';

import { createServerRouter } from '../src/index.ts';
import { serverLocationPlugin } from '../src/location.ts';
import { compileRoutes, matchRoute } from '../src/redirects.ts';
import type { RouteDeclaration } from '../src/redirects.ts';
import { compileRouteTrie } from '../src/route-trie.ts';
import { onceSettled } from '../src/simulate.ts';
import { routeTrie } from '../src/route-trie.ts';
import {
  urlPattern as url,
  urlPatternOf,
  urlPatternPlugin,
} from '../src/url-pattern.ts';

// Runs `run` on a runtime with no global URLPattern.
const withoutUrlPattern = (run: () => void): void => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'URLPattern')!;
  Reflect.deleteProperty(globalThis, 'URLPattern');

  try {
    run();
  } finally {
    Object.defineProperty(globalThis, 'URLPattern', descriptor);
  }
};

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
  it('declares a state url with no cast, read back by urlPatternOf', () => {
    const state: StateDeclaration = {
      name: 'files',
      url: url('/files/:dir/:name.:ext', { query: ['q'] }),
    };

    assert.deepEqual(urlPatternOf(state.url), {
      pathname: '/files/:dir/:name.:ext',
      query: ['q'],
    });
    assert.equal(urlPatternOf('/files/:dir'), null);
  });

  it('accepts a URLPattern whose other components are wildcards', () => {
    const declared = url(new URLPattern({ pathname: '/users/:id' }));
    assert.equal(urlPatternOf(declared)?.pathname, '/users/:id');
  });

  for (const [pathname, reason] of [
    ['/files/*', /'\*' at index 7 is outside the supported subset/],
    ['/users/:id?', /modifier '\?' at index 10/],
    ['/users/:id+', /modifier '\+'/],
    ['/users/(\\d+)', /'\(' at index 7/],
    ['/users{/:id}?', /'\{' at index 6/],
    ['/users/:id(\\d+', /unclosed '\('/],
    ['/users/:', /a ':' without a \\w name at index 7/],
  ] as const)
    it(`rejects ${pathname}`, () => {
      assert.throws(() => url(pathname), reason);
    });

  it('rejects components other than pathname', () => {
    assert.throws(
      () => url({ pathname: '/users', search: 'sort=:sort' }),
      /component 'search' must be absent or '\*'/,
    );
    assert.throws(
      () => url(new URLPattern({ pathname: '/a', hostname: 'x.test' })),
      /component 'hostname'/,
    );
  });

  it('rejects relative pathnames', () => {
    assert.throws(() => url('users'), /must start with '\/'/);
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

  it('names the polyfill when the runtime has no URLPattern', () => {
    withoutUrlPattern(() =>
      assert.throws(() => routerFor(), /load 'urlpattern-polyfill'/),
    );
  });

  it('reads its params, inherited or own, and is never the root url', () => {
    const { url: matcher } =
      routerFor().stateRegistry.get('users.detail').$$state!();

    assert.equal(matcher.isRoot(), false);
    assert.equal(matcher.parameter('sort')?.id, 'sort');
    assert.equal(matcher.parameter('sort', { inherit: false }), null);
    assert.equal(matcher.parameter('id', { inherit: false })?.id, 'id');
    assert.equal(matcher.parameter('nope'), null);
  });

  it('carries the hash through match and href', () => {
    const router = routerFor();
    assert.deepEqual(
      router.urlService.match({ path: '/by/a', search: {}, hash: 'top' })
        ?.match,
      { slug: 'a', '#': 'top' },
    );
    assert.equal(
      router.stateService.href('slug', { slug: 'a', '#': 'top' }),
      '/by/a#top',
    );
  });

  // A string type core leaves unencoded.
  const rawRouter = (states: StateDeclaration[]): UIRouter => {
    const router = new UIRouter();
    const { config } = router.urlService;
    // SAFETY: core types its type registry's getter as any; 'string' is a built-in ParamType.
    const string = config.type('string') as ParamType;
    config.type('raw', {
      encode: (value: string) => value,
      decode: (value: string) => value,
      is: (value: string) => string.is(value),
      equals: (a: string, b: string) => a === b,
      pattern: string.pattern,
      raw: true,
    });
    router.plugin(servicesPlugin);
    router.plugin(serverLocationPlugin);
    router.plugin(urlPatternPlugin);
    states.forEach((state) => router.stateRegistry.register(state));

    return router;
  };

  it('encodes query params as core does: replace, squash, arrays and raw', () => {
    const router = rawRouter([
      {
        name: 'list',
        url: url('/list', { query: ['sort', 'page', 'tag', 'raw'] }),
        params: {
          sort: { value: 'name', squash: true },
          page: { value: '1' },
          tag: { array: true },
          raw: { type: 'raw' },
        },
      },
    ]);

    assert.deepEqual(
      coreMatch(router, '/list', { sort: '', tag: ['a', 'b'] }),
      {
        state: 'list',
        params: { sort: 'name', page: '1', tag: ['a', 'b'], raw: undefined },
      },
    );
    assert.equal(
      router.stateService.href('list', { tag: ['a b', 'c'], raw: 'x/y' }),
      '/list?page=1&tag=a%20b&tag=c&raw=x/y',
    );
  });

  it('decodes path groups only when the url config decodes params', () => {
    const router = new UIRouter();
    router.urlService.config._decodeParams = false;
    router.plugin(urlPatternPlugin);
    router.stateRegistry.register({ name: 'slug', url: url('/by/:slug') });
    assert.deepEqual(coreMatch(router, '/by/a%20b')?.params, { slug: 'a%20b' });
  });

  it('formats raw path groups unencoded, and null for an empty group', () => {
    const { stateService } = rawRouter([
      { name: 'raw', url: url('/raw/:id'), params: { id: { type: 'raw' } } },
      { name: 'slug', url: url('/by/:slug') },
    ]);

    assert.equal(stateService.href('raw', { id: 'a@b' }), '/raw/a@b');
    assert.equal(stateService.href('slug', { slug: '' }), null);
  });

  it("hands urls back to core's builder once disposed", () => {
    const router = new UIRouter();
    router.plugin(urlPatternPlugin).dispose?.(router);
    assert.throws(() =>
      router.stateRegistry.register({ name: 'a', url: url('/a') }),
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
  // String states beside URLPattern states, in one table.
  const mixedTable = (): RouteDeclaration[] => [
    ...table(),
    { name: 'legacy', url: '/legacy/{id:int}' },
    { name: 'legacy.edit', url: '/edit' },
    { name: 'shell', url: '' },
    { name: 'shell.about', url: url('/about') },
    { name: 'colon', url: url('/time/\\:now') },
  ];

  const paths: string[] = [
    '/',
    '/users',
    '/users/42',
    '/users/42/edit',
    '/users/new',
    '/users/abc',
    '/files/docs/a.b.c',
    '/codes/abc',
    '/codes/abcd',
    '/by/a%20b',
    '/by/',
    '/legacy/3',
    '/legacy/3/edit',
    '/legacy/x',
    '/about',
    '/time/:now',
    '/nope',
  ];

  it('scan, trie and a core router with the plugin agree on a mixed table', () => {
    const router = routerFor(mixedTable());
    const routes = compileRoutes(mixedTable());
    const trie = compileRouteTrie(routes);
    assert.deepEqual(trie.inexpressible, []);

    for (const path of paths) {
      const engine = coreMatch(router, path);
      assert.deepEqual(matchRoute(routes, path), engine, path);
      assert.deepEqual(trie.match(path), engine, path);
    }
  });

  it('agrees on non-strict and case-insensitive configs', () => {
    for (const config of [{ strict: false }, { caseInsensitive: true }]) {
      const router = new UIRouter();
      router.plugin(servicesPlugin);
      router.urlService.config.strictMode(config.strict ?? true);
      router.urlService.config.caseInsensitive(config.caseInsensitive ?? false);
      router.plugin(urlPatternPlugin);
      mixedTable().forEach((state) => router.stateRegistry.register(state));
      const routes = compileRoutes(mixedTable(), config);

      for (const path of [...paths, '/users/42/', '/USERS/42', '/About/']) {
        assert.deepEqual(
          matchRoute(routes, path),
          coreMatch(router, path),
          `${JSON.stringify(config)} ${path}`,
        );
      }
    }
  });

  it('keeps routes the trie would mis-prune out of it', () => {
    const { inexpressible } = compileRouteTrie(
      compileRoutes([
        { name: 'any', url: url('/any/:rest(.*)') },
        { name: 'cafe', url: url('/café') },
      ]),
    );

    assert.deepEqual(
      inexpressible.map(({ route, reason }) => [route.name, reason]),
      [
        ['any', 'slash-spanning-param'],
        ['cafe', 'encoded-literal'],
      ],
    );
  });

  it('names an encoded literal when routeTrie refuses it', () => {
    assert.throws(
      () =>
        createServerRouter({
          mounts: {
            '/app': {
              routes: [{ name: 'cafe', url: url('/café') }],
              routeIndex: routeTrie,
            },
          },
        }),
      {
        message:
          "Mount '/app': routeTrie can't express route 'cafe' ('/café'): its literal text holds a character URLPattern encodes",
      },
    );
  });

  it('formats redirect targets through the engine', async () => {
    const server = createServerRouter({
      mounts: {
        '/app': {
          routes: [
            ...table(),
            { name: 'old', url: '/old/:id', redirectTo: 'users.detail' },
            { name: 'bad', url: '/bad/:code', redirectTo: 'codes' },
            { name: 'empty', url: '/empty/{slug:[a-z]*}', redirectTo: 'slug' },
          ],
        },
      },
    });

    assert.deepEqual(await server.resolve('/app/old/7'), {
      kind: 'redirect',
      mount: '/app',
      location: '/app/users/7',
      status: 302,
    });
    assert.notEqual((await server.resolve('/app/bad/abcd')).kind, 'redirect');
    assert.notEqual((await server.resolve('/app/empty/')).kind, 'redirect');
  });

  it('rejects mixing the two url syntaxes in one chain', () => {
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', url: '/a' },
          { name: 'a.b', url: url('/b') },
        ]),
      /Route 'a\.b': URLPattern url '\/b' can't extend string url '\/a'/,
    );
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', url: url('/a') },
          { name: 'a.b', url: '/b' },
        ]),
      /Route 'a\.b': string url '\/b' can't extend URLPattern url '\/a'/,
    );
  });

  it('applies the subset rules at compile', () => {
    assert.throws(
      () =>
        compileRoutes([
          {
            name: 'a',
            url: url('/a/:id(\\d+)'),
            params: { id: { type: 'int' } },
          },
        ]),
      /Route 'a': URLPattern group ':id' takes a regexp or a declared type, not both/,
    );
    assert.throws(
      () =>
        compileRoutes([{ name: 'a', url: url('/a/:id'), params: { id: 'x' } }]),
      /group ':id' is required, so it can't declare a default/,
    );
    assert.throws(
      () =>
        compileRoutes([
          { name: 'a', url: url('/a/:id') },
          { name: 'a.b', url: url('/b/:id') },
        ]),
      /^Error: Route 'a\.b': /,
    );
  });

  it('names the polyfill when the runtime has no URLPattern', () => {
    withoutUrlPattern(() => {
      assert.throws(() => compileRoutes(table()), /load 'urlpattern-polyfill'/);
      assert.equal(compileRoutes([{ name: 'plain', url: '/plain' }]).length, 1);
    });
  });

  for (const strategy of ['matcher', 'simulate'] as const)
    it(`resolves verdicts with the ${strategy} strategy`, async () => {
      const server = createServerRouter({
        mounts: { '/app': { routes: mixedTable(), strategy } },
      });

      for (const [path, kind] of [
        ['/app/users/42/edit', 'shell'],
        ['/app/legacy/3/edit', 'shell'],
        ['/app/about', 'shell'],
        ['/app/users/abc', 'notFound'],
        ['/app/codes/abcd', 'notFound'],
      ] as const)
        assert.equal((await server.resolve(path)).kind, kind, path);
    });
});
