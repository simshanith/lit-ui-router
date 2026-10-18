import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { TestContext } from 'node:test';

import { StateRegistry } from '@uirouter/core';

import {
  createServerRouter,
  diagnoseMounts,
  mergeSearch,
  routeTrie,
} from '../src/index.ts';
import type { MountConfig } from '../src/index.ts';
import { delegateKeysOf } from '../src/delegate-keys.ts';
import { warnMountDiagnostics } from '../src/dev-warn.ts';
import { stubDev } from './import-meta-env.ts';

// 'trie' is the matcher strategy over routeTrie: every tier must reach the same verdicts.
type Tier = MountConfig['strategy'] | 'trie';

const TIERS = ['matcher', 'trie', 'simulate'] as const;

const tierConfig = (tier: Tier): Partial<MountConfig> =>
  tier === 'trie'
    ? { strategy: 'matcher', routeIndex: routeTrie }
    : { strategy: tier };

const appMount = (strategy: Tier): MountConfig => ({
  ...tierConfig(strategy),
  routes: [
    { name: 'welcome', url: '/welcome' },
    { name: 'contacts', url: '/contacts' },
    { name: 'contacts.detail', url: '/:contactId' },
    { name: 'legacy', url: '/legacy', redirectTo: 'contacts' },
    {
      name: 'first',
      url: '/first',
      // Non-string params (RawParams admits them) must survive both
      // strategies: format() decodes stringly, like the live router.
      redirectTo: { state: 'contacts.detail', params: { contactId: 1 } },
    },
    { name: 'inbox', url: '/inbox?page' },
  ],
  redirects: [
    { pattern: /^\/?$/, to: 'welcome' },
    { pattern: '/old-inbox', to: { state: 'inbox', params: { page: '2' } } },
  ],
});

// Every verdict below is asserted for BOTH strategies: the same mount config
// must resolve identically whether it's evaluated as data or replayed
// through a headless core router.
for (const strategy of TIERS) {
  describe(`verdicts (${strategy} strategy)`, () => {
    const router = createServerRouter({
      mounts: { '/app': appMount(strategy) },
    });

    it('serves the shell for plain routes, status absent (default handling)', async () => {
      const verdict = await router.resolve('/app/welcome');
      assert.deepEqual(verdict, { kind: 'shell', mount: '/app' });
      assert.ok(!('status' in verdict));
      assert.deepEqual(await router.resolve('/app/contacts/3'), {
        kind: 'shell',
        mount: '/app',
      });
    });

    it('redirects the mount root via the pattern rule', async () => {
      assert.deepEqual(await router.resolve('/app'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/welcome',
        status: 302,
      });
      assert.deepEqual(await router.resolve('/app/'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/welcome',
        status: 302,
      });
    });

    it('redirects via state redirectTo', async () => {
      assert.deepEqual(await router.resolve('/app/legacy'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/contacts',
        status: 302,
      });
    });

    it('formats non-string target params', async () => {
      assert.deepEqual(await router.resolve('/app/first'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/contacts/1',
        status: 302,
      });
    });

    it('reports notFound, carrying the owning mount when there is one', async () => {
      assert.deepEqual(await router.resolve('/app/nope'), {
        kind: 'notFound',
        mount: '/app',
      });
      assert.deepEqual(await router.resolve('/elsewhere'), {
        kind: 'notFound',
      });
    });

    it('may carry the target query string inside location', async () => {
      // The pin for the query contract: consumers merge params into this,
      // never concatenate the request's search onto it.
      assert.deepEqual(await router.resolve('/app/old-inbox'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/inbox?page=2',
        status: 302,
      });
    });

    it('accepts absolute urls and URL-shaped objects', async () => {
      assert.deepEqual(
        await router.resolve('https://example.test/app/legacy?q=1#frag'),
        {
          kind: 'redirect',
          mount: '/app',
          location: '/app/contacts',
          status: 302,
        },
      );
      assert.deepEqual(await router.resolve({ pathname: '/app/welcome' }), {
        kind: 'shell',
        mount: '/app',
      });
    });
  });
}

// The otherwise projection: the mount declares the client's otherwise()
// mapping (a url-less notFound state), and unknown paths become shell-404
// verdicts — the shell is the error page, at the retained path.
const appMountWith404 = (strategy: Tier): MountConfig => {
  const mount = appMount(strategy);

  return {
    ...mount,
    routes: [...mount.routes, { name: 'notFound' }],
    otherwise: { state: 'notFound' },
  };
};

for (const strategy of TIERS) {
  describe(`otherwise projection (${strategy} strategy)`, () => {
    const router = createServerRouter({
      mounts: { '/app': appMountWith404(strategy) },
    });

    it('serves the shell at 404 for unknown paths', async () => {
      assert.deepEqual(await router.resolve('/app/nope'), {
        kind: 'shell',
        mount: '/app',
        status: 404,
      });
      assert.deepEqual(await router.resolve('/app/contacts/3/nope'), {
        kind: 'shell',
        mount: '/app',
        status: 404,
      });
    });

    it('never outranks a route match or a redirect rule', async () => {
      // Precedence, as in the client: rules and matchers first, then 404.
      assert.deepEqual(await router.resolve('/app/welcome'), {
        kind: 'shell',
        mount: '/app',
      });
      assert.deepEqual(await router.resolve('/app'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/welcome',
        status: 302,
      });
      assert.deepEqual(await router.resolve('/app/legacy'), {
        kind: 'redirect',
        mount: '/app',
        location: '/app/contacts',
        status: 302,
      });
    });
  });
}

// The mount's config reaches both tiers: core compiles state urls at
// registration, so simulate must apply it before the routes register.
for (const strategy of TIERS) {
  describe(`url config (${strategy} strategy)`, () => {
    // An optional path param mid-url, and a redirect that formats it at its default.
    const squashMount = (config: MountConfig['config'] = {}): MountConfig => {
      const mount = appMount(strategy);

      return {
        ...mount,
        config,
        routes: [
          ...mount.routes,
          {
            name: 'docs',
            url: '/docs/:section/page',
            params: { section: { value: 'intro' } },
          },
          { name: 'manual', url: '/manual', redirectTo: 'docs' },
        ],
      };
    };

    const router = createServerRouter({
      mounts: {
        '/app': appMount(strategy),
        '/loose': { ...appMount(strategy), config: { strict: false } },
        // routeTrie can't express caseInsensitive, so the trie tier scans this one.
        '/nocase': {
          ...appMount(strategy === 'trie' ? 'matcher' : strategy),
          config: { caseInsensitive: true },
        },
        '/nosquash': squashMount(),
        '/squash': squashMount({ defaultSquashPolicy: true }),
        '/tilde': squashMount({ defaultSquashPolicy: '~' }),
      },
    });

    const shell = (mount: string) => ({ kind: 'shell', mount });

    const redirect = (mount: string, location: string) => ({
      kind: 'redirect',
      mount,
      location,
      status: 302,
    });

    it('keeps strict, case-sensitive matching by default', async () => {
      assert.deepEqual(await router.resolve('/app/welcome/'), {
        kind: 'notFound',
        mount: '/app',
      });
      assert.deepEqual(await router.resolve('/app/WELCOME'), {
        kind: 'notFound',
        mount: '/app',
      });
    });

    it('matches routes and redirects with a trailing slash under strict: false', async () => {
      // The second pass runs on pooled routers: reset() leaves url config alone.
      for (let pass = 0; pass < 2; pass++) {
        assert.deepEqual(
          await router.resolve('/loose/welcome'),
          shell('/loose'),
        );
        assert.deepEqual(
          await router.resolve('/loose/welcome/'),
          shell('/loose'),
        );
        assert.deepEqual(
          await router.resolve('/loose/contacts/3/'),
          shell('/loose'),
        );
        assert.deepEqual(
          await router.resolve('/loose/legacy/'),
          redirect('/loose', '/loose/contacts'),
        );
        assert.deepEqual(
          await router.resolve('/loose/old-inbox/'),
          redirect('/loose', '/loose/inbox?page=2'),
        );
      }
    });

    it('matches routes and redirects in any case under caseInsensitive: true', async () => {
      for (let pass = 0; pass < 2; pass++) {
        assert.deepEqual(
          await router.resolve('/nocase/WELCOME'),
          shell('/nocase'),
        );
        assert.deepEqual(
          await router.resolve('/nocase/Contacts/3'),
          shell('/nocase'),
        );
        assert.deepEqual(
          await router.resolve('/nocase/LEGACY'),
          redirect('/nocase', '/nocase/contacts'),
        );
        assert.deepEqual(
          await router.resolve('/nocase/Old-Inbox'),
          redirect('/nocase', '/nocase/inbox?page=2'),
        );
      }
    });

    it('writes defaulted params out by default', async () => {
      assert.deepEqual(await router.resolve('/nosquash/docs/page'), {
        kind: 'notFound',
        mount: '/nosquash',
      });
      assert.deepEqual(
        await router.resolve('/nosquash/docs/intro/page'),
        shell('/nosquash'),
      );
      assert.deepEqual(
        await router.resolve('/nosquash/manual'),
        redirect('/nosquash', '/nosquash/docs/intro/page'),
      );
    });

    it('drops defaulted params and a slash under defaultSquashPolicy: true', async () => {
      for (let pass = 0; pass < 2; pass++) {
        assert.deepEqual(
          await router.resolve('/squash/docs/page'),
          shell('/squash'),
        );
        assert.deepEqual(
          await router.resolve('/squash/docs/intro/page'),
          shell('/squash'),
        );
        assert.deepEqual(
          await router.resolve('/squash/docs/guide/page'),
          shell('/squash'),
        );
        assert.deepEqual(
          await router.resolve('/squash/manual'),
          redirect('/squash', '/squash/docs/page'),
        );
      }
    });

    it('spells defaulted params as the placeholder under a string defaultSquashPolicy', async () => {
      for (let pass = 0; pass < 2; pass++) {
        assert.deepEqual(
          await router.resolve('/tilde/docs/~/page'),
          shell('/tilde'),
        );
        assert.deepEqual(
          await router.resolve('/tilde/docs/intro/page'),
          shell('/tilde'),
        );
        assert.deepEqual(await router.resolve('/tilde/docs/page'), {
          kind: 'notFound',
          mount: '/tilde',
        });
        assert.deepEqual(
          await router.resolve('/tilde/manual'),
          redirect('/tilde', '/tilde/docs/~/page'),
        );
      }
    });
  });
}

const delegateMount = (strategy: Tier): MountConfig => ({
  ...tierConfig(strategy),
  routes: [
    { name: 'home', url: '' },
    { name: 'claims', url: '/claims', delegate: 'ledger' },
    // Not inherited: a child of a delegating state serves the shell.
    { name: 'claims.detail', url: '/:claimId' },
    { name: 'receipt', url: '/receipts/{receiptId:int}', delegate: 'ledger' },
    { name: 'old', url: '/old-claims', redirectTo: 'claims' },
  ],
  redirects: [{ pattern: '/submit', to: 'claims' }],
});

for (const strategy of TIERS) {
  describe(`delegate verdicts (${strategy} strategy)`, () => {
    const router = createServerRouter({
      mounts: { '/app': delegateMount(strategy) },
    });

    it('delegates a delegating state with its key, state and params', async () => {
      assert.deepEqual(await router.resolve('/app/claims'), {
        kind: 'delegate',
        mount: '/app',
        delegate: 'ledger',
        state: 'claims',
        params: {},
      });
      assert.deepEqual(await router.resolve('/app/receipts/7?x=1'), {
        kind: 'delegate',
        mount: '/app',
        delegate: 'ledger',
        state: 'receipt',
        params: { receiptId: 7 },
      });
    });

    it('serves the shell for a child of a delegating state', async () => {
      assert.deepEqual(await router.resolve('/app/claims/3'), {
        kind: 'shell',
        mount: '/app',
      });
    });

    it('redirects into a delegating state like any other', async () => {
      for (const path of ['/app/old-claims', '/app/submit'])
        assert.deepEqual(await router.resolve(path), {
          kind: 'redirect',
          mount: '/app',
          location: '/app/claims',
          status: 302,
        });
    });

    it('counts a delegating bare base as served', () => {
      const bare = createServerRouter({
        mounts: {
          '/api': {
            ...tierConfig(strategy),
            routes: [{ name: 'api', url: '', delegate: 'api' }],
          },
        },
      });

      assert.deepEqual(diagnoseMounts(bare), []);
    });
  });
}

describe('delegate configuration', () => {
  const mountOf = (routes: MountConfig['routes']) => ({
    mounts: { '/app': { routes } },
  });

  it('rejects a url-less, redirecting or empty delegate at construction', () => {
    assert.throws(
      () => createServerRouter(mountOf([{ name: 'cmd', delegate: 'ledger' }])),
      /delegating state 'cmd' must declare a url/,
    );
    assert.throws(
      () =>
        createServerRouter(
          mountOf([
            { name: 'home', url: '/' },
            { name: 'cmd', url: '/cmd', delegate: 'x', redirectTo: 'home' },
          ]),
        ),
      /delegating state 'cmd' cannot also declare redirectTo/,
    );
    assert.throws(
      () =>
        createServerRouter(
          mountOf([{ name: 'cmd', url: '/cmd', delegate: '' }]),
        ),
      /state 'cmd' delegate must not be empty/,
    );
  });

  it('reports the keys a router names, and nothing for a foreign router', () => {
    const router = createServerRouter({
      mounts: {
        '/app': delegateMount('matcher'),
        '/api': { routes: [{ name: 'api', url: '', delegate: 'api' }] },
      },
    });

    assert.deepEqual([...(delegateKeysOf(router) ?? [])].sort(), [
      'api',
      'ledger',
    ]);
    assert.equal(
      delegateKeysOf({ resolve: () => Promise.reject(new Error()) }),
      undefined,
    );
  });
});

describe('otherwise configuration', () => {
  it('is per-mount: an undeclared mount keeps its notFound verdict', async () => {
    const router = createServerRouter({
      mounts: {
        '/app': appMountWith404('matcher'),
        '/other': appMount('matcher'),
      },
    });

    assert.deepEqual(await router.resolve('/app/nope'), {
      kind: 'shell',
      mount: '/app',
      status: 404,
    });
    assert.deepEqual(await router.resolve('/other/nope'), {
      kind: 'notFound',
      mount: '/other',
    });
    assert.deepEqual(await router.resolve('/elsewhere'), { kind: 'notFound' });
  });

  it('rejects undeclared and url-full otherwise states at construction', () => {
    assert.throws(
      () =>
        createServerRouter({
          mounts: {
            '/app': {
              routes: [{ name: 'a', url: '/a' }],
              otherwise: { state: 'missing' },
            },
          },
        }),
      /otherwise state 'missing' is not declared/,
    );
    assert.throws(
      () =>
        createServerRouter({
          mounts: {
            '/app': {
              routes: [{ name: 'a', url: '/a' }],
              otherwise: { state: 'a' },
            },
          },
        }),
      /must be url-less/,
    );
  });
});

describe('mount handling', () => {
  it('routes to the longest matching mount base', async () => {
    const router = createServerRouter({
      mounts: {
        '/': { routes: [{ name: 'root', url: '/root' }] },
        '/app': appMount('matcher'),
      },
    });

    assert.deepEqual(await router.resolve('/app/welcome'), {
      kind: 'shell',
      mount: '/app',
    });
    assert.deepEqual(await router.resolve('/root'), {
      kind: 'shell',
      mount: '/',
    });
    // The owning mount's verdict never falls through to a shorter base.
    assert.deepEqual(await router.resolve('/app/nope'), {
      kind: 'notFound',
      mount: '/app',
    });
  });

  it('joins redirect locations onto a root mount cleanly', async () => {
    const router = createServerRouter({
      mounts: { '/': appMount('matcher') },
    });

    assert.deepEqual(await router.resolve('/'), {
      kind: 'redirect',
      mount: '/',
      location: '/welcome',
      status: 302,
    });
  });

  it('rejects invalid and duplicate mounts, and bad matcher config, eagerly', () => {
    assert.throws(
      () => createServerRouter({ mounts: { app: appMount('matcher') } }),
      /must start with '\/'/,
    );
    assert.throws(
      () =>
        createServerRouter({
          mounts: { '/app': appMount('matcher'), '/app/': appMount('matcher') },
        }),
      /unique/,
    );
    assert.throws(
      () =>
        createServerRouter({
          mounts: {
            '/app': {
              routes: [{ name: 'a', url: '/a', redirectTo: 'missing' }],
            },
          },
        }),
      /unknown or url-less state 'missing'/,
    );
  });
});

describe('mount diagnostics', () => {
  const warnings = (t: TestContext, mounts: Record<string, MountConfig>) => {
    const messages: string[] = [];

    const warn = t.mock.method(console, 'warn', (message: string) => {
      messages.push(message);
    });

    createServerRouter({ mounts });
    warn.mock.restore();

    return messages;
  };

  const unserved = (strategy: Tier): MountConfig => ({
    ...tierConfig(strategy),
    routes: [{ name: 'a', url: '/a' }],
  });

  // A squashed param whose `is` throws: only resolving the bare base calls it.
  const trippedMount = {
    routes: [
      {
        name: 'item',
        url: '/:id',
        params: {
          id: {
            type: {
              name: 'tripped',
              pattern: /[^/]*/,
              is: (_value: unknown): _value is string => {
                throw new Error('tripped');
              },
              decode: (value: string) => value,
            },
            value: 'x',
            squash: true,
          },
        },
      },
    ],
  } satisfies MountConfig;

  const served = {
    '/app-hash': {
      routes: [{ name: 'root', url: '' }],
      config: { strict: false },
    },
    '/plain': { routes: [{ name: 'root', url: '' }] },
    '/plain-trie': {
      routes: [{ name: 'root', url: '' }],
      routeIndex: routeTrie,
    },
    '/rule': appMount('matcher'),
    '/rule-trie': appMount('trie'),
    '/': { routes: [{ name: 'a', url: '/a' }] },
  } satisfies Record<string, MountConfig>;

  // Built silently, so the findings come from diagnoseMounts alone.
  const diagnosed = (mounts: Record<string, MountConfig>) => {
    const restore = stubDev(false);

    try {
      return diagnoseMounts(createServerRouter({ mounts }));
    } finally {
      restore();
    }
  };

  for (const strategy of TIERS) {
    it(`reports each mount whose bare base 404s, in declaration order (${strategy} strategy)`, () => {
      const diagnostics = diagnosed({
        '/b/': unserved(strategy),
        '/served': appMount(strategy),
        '/a': unserved(strategy),
      });

      assert.deepEqual(
        diagnostics.map(({ kind, mount }) => ({ kind, mount })),
        [
          { kind: 'bareBaseNotFound', mount: '/b' },
          { kind: 'bareBaseNotFound', mount: '/a' },
        ],
      );
      const [{ message }] = diagnostics;
      assert.match(message, /mount '\/b' answers its bare base/);
      assert.match(message, /url: '' route/);
      assert.match(message, /\{ pattern: \/\^\\\/\?\$\/, to: '<state>' \}/);
    });
  }

  it('counts the otherwise shell-404 as a 404, a root redirect beside it as served', () => {
    assert.deepEqual(diagnosed({ '/app': appMountWith404('matcher') }), []);
    assert.deepEqual(
      diagnosed({
        '/app': {
          routes: [{ name: 'a', url: '/a' }, { name: 'notFound' }],
          otherwise: { state: 'notFound' },
        },
      }).map(({ mount }) => mount),
      ['/app'],
    );
  });

  it('skips a mount whose bare-base resolve throws, and still reports the others', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});

    const table = {
      '/tripped': trippedMount,
      '/a': unserved('matcher'),
    } satisfies Record<string, MountConfig>;

    const router = createServerRouter({ mounts: table });

    assert.deepEqual(
      diagnoseMounts(router).map(({ mount }) => mount),
      ['/a'],
    );
    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(
      diagnosed(table).map(({ mount }) => mount),
      ['/a'],
    );
  });

  it("finds nothing for a url: '' route, its strict: false slash form, the root rule, and the '/' mount", () => {
    // The CI usage: an empty result is the assertion.
    assert.deepEqual(diagnosed(served), []);
  });

  const mixed = {
    ...served,
    '/x': unserved('matcher'),
    '/y': unserved('simulate'),
  } satisfies Record<string, MountConfig>;

  const messages = () =>
    diagnosed(mixed).map(
      ({ message }) => `ui-router-server: createServerRouter: ${message}`,
    );

  it('warns at construction in development with exactly the diagnostics messages', (t) => {
    assert.equal(messages().length, 2);
    assert.deepEqual(warnings(t, mixed), messages());
    assert.deepEqual(warnings(t, served), []);
  });

  it('stays silent in production, where diagnoseMounts still reports', (t) => {
    t.after(stubDev(false));

    assert.deepEqual(warnings(t, mixed), []);
    assert.deepEqual(
      diagnosed(mixed).map(({ mount }) => mount),
      ['/x', '/y'],
    );
  });

  for (const [nodeEnv, warns] of [
    [undefined, true],
    ['development', true],
    ['test', true],
    ['production', false],
  ] as const) {
    it(`warns under node unless NODE_ENV is production (NODE_ENV=${nodeEnv})`, (t) => {
      const previous = process.env.NODE_ENV;

      t.after(() => {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
      });

      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;

      assert.deepEqual(warnings(t, mixed), warns ? messages() : []);
    });
  }

  it('never diagnoses in production, nor under node with NODE_ENV=production', (t) => {
    t.mock.method(console, 'warn', () => {});
    const router = createServerRouter({ mounts: mixed });
    const diagnose = t.mock.fn(diagnoseMounts);
    const previous = process.env.NODE_ENV;

    t.after(() => {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    });

    const restoreDev = stubDev(false);
    warnMountDiagnostics(router, diagnose);
    restoreDev();

    process.env.NODE_ENV = 'production';
    warnMountDiagnostics(router, diagnose);

    assert.equal(diagnose.mock.callCount(), 0);
  });

  it('skips an ignored kind on its mount alone, in warnings and diagnoseMounts', (t) => {
    const table = {
      '/quiet': {
        ...unserved('matcher'),
        ignoreDiagnostics: ['bareBaseNotFound'],
      },
      '/loud': unserved('simulate'),
      '/served': {
        ...appMount('matcher'),
        ignoreDiagnostics: ['bareBaseNotFound'],
      },
    } satisfies Record<string, MountConfig>;

    const [finding, ...rest] = diagnosed(table);

    assert.deepEqual(rest, []);
    assert.equal(finding.mount, '/loud');
    assert.deepEqual(warnings(t, table), [
      `ui-router-server: createServerRouter: ${finding.message}`,
    ]);
  });

  it('throws at construction for an unknown ignoreDiagnostics kind', () => {
    // SAFETY: deliberately outside MountDiagnosticKind, as untyped JS could pass
    const config = JSON.parse(
      '{ "routes": [], "ignoreDiagnostics": ["bareBase"] }',
    ) as MountConfig;

    assert.throws(
      () => createServerRouter({ mounts: { '/app': config } }),
      /Mount '\/app': ignoreDiagnostics names unknown kind 'bareBase' \(known: bareBaseNotFound\)/,
    );
  });

  it('throws for a router createServerRouter did not build', () => {
    const fake = {
      resolve: () => Promise.resolve({ kind: 'notFound' as const }),
    };

    assert.throws(
      () => diagnoseMounts(fake),
      /diagnoseMounts: expected a router from createServerRouter in this copy of ui-router-server/,
    );
  });

  it('throws for an invalid table before it warns', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const duplicate = { '/app': { routes: [] }, '/app/': { routes: [] } };

    assert.throws(() => createServerRouter({ mounts: duplicate }), /unique/);
    assert.equal(warn.mock.callCount(), 0);
  });
});

describe('simulate strategy isolation', () => {
  it('resolves concurrent requests independently', async () => {
    const router = createServerRouter({
      mounts: { '/app': appMount('simulate') },
    });

    const verdicts = await Promise.all([
      router.resolve('/app'),
      router.resolve('/app/welcome'),
      router.resolve('/app/legacy'),
      router.resolve('/app'),
    ]);

    assert.deepEqual(
      verdicts.map((verdict) =>
        verdict.kind === 'redirect' ? verdict.location : verdict.kind,
      ),
      ['/app/welcome', 'shell', '/app/contacts', '/app/welcome'],
    );
  });

  it('leaves no timer pending once a verdict resolves', async () => {
    const router = createServerRouter({
      mounts: { '/app': appMount('simulate') },
    });

    const pendingTimers = () =>
      process.getActiveResourcesInfo().filter((name) => name === 'Timeout')
        .length;

    const before = pendingTimers();
    await router.resolve('/app/legacy');

    assert.equal(pendingTimers(), before);
  });

  // Shell, redirect and 404 verdicts, plus the param-carrying states a reused
  // router could leak into the next request through inherited params.
  const probes = [
    '/app',
    '/app/welcome',
    '/app/legacy',
    '/app/first',
    '/app/contacts',
    '/app/contacts/3',
    '/app/contacts/4',
    '/app/inbox',
    '/app/old-inbox',
    '/app/nope',
  ];

  const freshVerdict = (path: string) =>
    createServerRouter({
      mounts: { '/app': appMountWith404('simulate') },
    }).resolve(path);

  it('resolves interleaved requests on one mount to distinct verdicts', async () => {
    const router = createServerRouter({
      mounts: { '/app': appMountWith404('simulate') },
    });

    const expected = await Promise.all(probes.map(freshVerdict));

    // Warm the pool, then interleave three rounds in a rotated order.
    await Promise.all(probes.map((path) => router.resolve(path)));

    const rounds = [0, 1, 2].map((round) => [
      ...probes.slice(round * 4),
      ...probes.slice(0, round * 4),
    ]);

    const verdicts = await Promise.all(
      rounds.flat().map((path) => router.resolve(path)),
    );

    assert.deepEqual(
      verdicts,
      rounds.flat().map((path) => expected[probes.indexOf(path)]),
    );
  });

  it('leaks no state from one request into the next', async () => {
    const router = createServerRouter({
      mounts: { '/app': appMountWith404('simulate') },
    });

    const expected = await Promise.all(probes.map(freshVerdict));

    // Sequential pairs run on the same pooled router, each after every other.
    for (const before of probes) {
      for (const [index, path] of probes.entries()) {
        await router.resolve(before);
        assert.deepEqual(
          await router.resolve(path),
          expected[index],
          `${path} after ${before}`,
        );
      }
    }
  });

  it('reuses a router after a redirect, an otherwise 404 and a timeout', async () => {
    let release = (): void => {};

    // Data-only declarations can't hang a transition; a core resolve can.
    const hang = {
      name: 'hang',
      url: '/hang',
      resolve: [
        {
          token: 'never',
          resolveFn: () =>
            new Promise<void>((resolve) => {
              release = resolve;
            }),
        },
      ],
    };

    const mount = appMountWith404('simulate');

    const router = createServerRouter({
      mounts: { '/app': { ...mount, routes: [...mount.routes, hang] } },
    });

    const redirect = {
      kind: 'redirect',
      mount: '/app',
      location: '/app/contacts',
      status: 302,
    };

    const notFound = { kind: 'shell', mount: '/app', status: 404 };

    assert.deepEqual(await router.resolve('/app/legacy'), redirect);
    assert.deepEqual(await router.resolve('/app/legacy'), redirect);
    assert.deepEqual(await router.resolve('/app/nope'), notFound);
    assert.deepEqual(await router.resolve('/app/nope'), notFound);
    assert.deepEqual(await router.resolve('/app/old-inbox'), {
      kind: 'redirect',
      mount: '/app',
      location: '/app/inbox?page=2',
      status: 302,
    });
    assert.deepEqual(await router.resolve('/app/inbox'), {
      kind: 'shell',
      mount: '/app',
    });

    const pendingTimers = () =>
      process.getActiveResourcesInfo().filter((name) => name === 'Timeout')
        .length;

    const timers = pendingTimers();

    // The timed-out router is still mid-transition; it must never serve again.
    assert.deepEqual(await router.resolve('/app/hang'), {
      kind: 'shell',
      mount: '/app',
    });
    assert.equal(pendingTimers(), timers);
    const pending = router.resolve('/app/legacy');
    release();
    assert.deepEqual(await pending, redirect);
    assert.deepEqual(await router.resolve('/app/nope'), notFound);
  });
});

describe('simulate prewarm', () => {
  // A headless router registers its states into its own registry, so distinct registries are builds.
  const countBuilds = () => {
    const register = mock.method(StateRegistry.prototype, 'register');

    return {
      register,
      builds: () => new Set(register.mock.calls.map((call) => call.this)).size,
    };
  };

  const prewarmed = (prewarm?: number) =>
    createServerRouter({
      mounts: {
        '/app': { ...appMount('simulate'), prewarm },
        '/static': appMount('matcher'),
      },
    });

  it('builds the prewarm count before the first request, which builds none', async (t) => {
    const { register, builds } = countBuilds();
    t.after(() => register.mock.restore());
    const router = prewarmed(3);

    assert.deepEqual(await router.resolve('/app/welcome'), {
      kind: 'shell',
      mount: '/app',
    });
    assert.equal(builds(), 3);
  });

  it('serves as many concurrent requests as it prewarmed without a build', async (t) => {
    const { register, builds } = countBuilds();
    t.after(() => register.mock.restore());
    const router = prewarmed(3);
    const paths = ['/app/welcome', '/app/legacy', '/app'];

    await Promise.all(paths.map((path) => router.resolve(path)));
    assert.equal(builds(), 3);

    await Promise.all([...paths, '/app'].map((path) => router.resolve(path)));
    assert.equal(builds(), 4);
  });

  it('builds nothing at construction by default', async (t) => {
    const { register, builds } = countBuilds();
    t.after(() => register.mock.restore());

    for (const prewarm of [undefined, 0]) {
      const router = prewarmed(prewarm);
      await router.resolve('/static/welcome');
      await router.resolve('/elsewhere');
    }

    assert.equal(builds(), 0);
  });

  it('rejects an invalid count, or a positive count on a matcher mount, at construction', async () => {
    for (const prewarm of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 17])
      assert.throws(
        () => prewarmed(prewarm),
        /Mount '\/app': prewarm must be an integer from 0 to 16/,
        `${prewarm}`,
      );

    assert.throws(
      () =>
        createServerRouter({
          mounts: { '/app': { ...appMount('matcher'), prewarm: 1 } },
        }),
      /Mount '\/app': prewarm needs the 'simulate' strategy/,
    );

    const router = createServerRouter({
      mounts: {
        '/app': { ...appMount(undefined), prewarm: 0 },
        '/max': { ...appMount('simulate'), prewarm: 16 },
      },
    });

    // Settles the prewarm here, not in a later test's spy.
    assert.deepEqual(await router.resolve('/max/welcome'), {
      kind: 'shell',
      mount: '/max',
    });
  });

  it('drops a failed prewarm build and builds on demand', async (t) => {
    const { register, builds } = countBuilds();
    t.after(() => register.mock.restore());
    register.mock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const router = prewarmed(2);

    assert.deepEqual(await router.resolve('/app/legacy'), {
      kind: 'redirect',
      mount: '/app',
      location: '/app/contacts',
      status: 302,
    });
    // The failed build stops the prewarm; the request built its own router.
    assert.equal(builds(), 2);
  });
});

describe('routeTrie mounts', () => {
  const build = (mount: MountConfig) =>
    createServerRouter({ mounts: { '/app': mount } });

  it('throws at construction for a case-insensitive mount, naming the mount, route and reason', () => {
    assert.throws(
      () => build({ ...appMount('trie'), config: { caseInsensitive: true } }),
      {
        message:
          /^Mount '\/app': routeTrie can't express route 'welcome' \('\/welcome'\): it compiles caseInsensitive; route 'contacts' /,
      },
    );
  });

  it('throws at construction for a param that may match a slash, naming it', () => {
    assert.throws(
      () =>
        build({
          routes: [
            { name: 'home', url: '' },
            { name: 'files', url: '/files/{path:.*}' },
          ],
          routeIndex: routeTrie,
        }),
      {
        message:
          "Mount '/app': routeTrie can't express route 'files' ('/files/{path:.*}'): its param 'path' may match a '/'",
      },
    );
  });

  it('builds the same routes on the default index', async () => {
    const router = build({
      routes: [{ name: 'files', url: '/files/{path:.*}' }],
    });

    assert.deepEqual(await router.resolve('/app/files/a/b'), {
      kind: 'shell',
      mount: '/app',
    });
  });

  it('throws on a simulate mount', () => {
    assert.throws(
      () => build({ ...appMount('simulate'), routeIndex: routeTrie }),
      { message: "Mount '/app': routeIndex needs the 'matcher' strategy" },
    );
  });

  it('prefixes the mount to whatever a custom index throws', () => {
    const cause = 'not an Error';

    assert.throws(
      () =>
        build({
          routes: [{ name: 'home', url: '' }],
          routeIndex: () => {
            // oxlint-disable-next-line typescript/only-throw-error -- the non-Error branch under test
            throw cause;
          },
        }),
      { message: "Mount '/app': not an Error", cause },
    );
  });

  it('consults a custom index for every route match', async () => {
    const looked: string[] = [];

    const router = build({
      routes: [{ name: 'home', url: '/home' }],
      routeIndex: () => (pathname) => {
        looked.push(pathname);

        return null;
      },
      ignoreDiagnostics: ['bareBaseNotFound'],
    });

    looked.length = 0;

    assert.deepEqual(await router.resolve('/app/home'), {
      kind: 'notFound',
      mount: '/app',
    });
    assert.deepEqual(looked, ['/home']);
  });
});

for (const routeIndex of [undefined, routeTrie]) {
  describe(`matcher strategy route scans (${routeIndex ? 'routeTrie' : 'linear'})`, () => {
    // Each successful route match decodes the captured id exactly once.
    let decodes = 0;

    const counted = {
      name: 'counted',
      pattern: /[^/]+/,
      is: (val: unknown): val is string => typeof val === 'string',
      decode: (val: string) => {
        decodes++;

        return val;
      },
    };

    const router = createServerRouter({
      mounts: {
        '/app': {
          routeIndex,
          routes: [
            { name: 'home', url: '' },
            {
              name: 'item',
              url: '/items/:id',
              params: { id: { type: counted } },
            },
          ],
          redirects: [
            { pattern: '/moved/:id', to: 'item' },
            {
              pattern: /^\/items\/self$/,
              to: { state: 'item', params: { id: 'self' } },
            },
          ],
        },
      },
    });

    const decodesFor = async (path: string) => {
      decodes = 0;
      const verdict = await router.resolve(path);

      return { kind: verdict.kind, decodes };
    };

    it('matches a served route once', async () => {
      assert.deepEqual(await decodesFor('/app/items/7'), {
        kind: 'shell',
        decodes: 1,
      });
    });

    it('skips route matching when a rule redirects', async () => {
      assert.deepEqual(await decodesFor('/app/moved/7'), {
        kind: 'redirect',
        decodes: 0,
      });
    });

    it('matches once after a rule that lands where it started', async () => {
      assert.deepEqual(await decodesFor('/app/items/self'), {
        kind: 'shell',
        decodes: 1,
      });
    });

    it('runs no decode for an unmatched pathname', async () => {
      assert.deepEqual(await decodesFor('/app/nowhere'), {
        kind: 'notFound',
        decodes: 0,
      });
    });
  });
}

describe('mergeSearch', () => {
  it('appends the request search to a bare location', () => {
    assert.equal(mergeSearch('/app/contacts', '?q=1'), '/app/contacts?q=1');
    assert.equal(mergeSearch('/app/contacts', 'q=1'), '/app/contacts?q=1');
  });

  it('merges into a location that carries its own query', () => {
    assert.equal(
      mergeSearch('/app/inbox?page=2', '?q=1'),
      '/app/inbox?page=2&q=1',
    );
  });

  it('lets the redirect target win on colliding keys', () => {
    assert.equal(
      mergeSearch('/app/inbox?page=2', '?page=9&q=1'),
      '/app/inbox?page=2&q=1',
    );
  });

  it('keeps all values of multi-value request keys', () => {
    assert.equal(mergeSearch('/a', 'x=1&x=2'), '/a?x=1&x=2');
    // The regression the old hand-rolled worker loop had: has(key) saw the
    // just-appended first instance and dropped a=2.
    assert.equal(mergeSearch('/x?p=1', 'a=1&a=2&b=3'), '/x?p=1&a=1&a=2&b=3');
  });

  it('round-trips percent-encoding', () => {
    assert.equal(mergeSearch('/a', '?q=a%2Fb'), '/a?q=a%2Fb');
  });

  it('is a no-op for an empty request search', () => {
    assert.equal(mergeSearch('/app/inbox?page=2', ''), '/app/inbox?page=2');
    assert.equal(mergeSearch('/app/contacts', '?'), '/app/contacts');
  });

  it('completes the query contract on a real redirect verdict', async () => {
    const router = createServerRouter({
      mounts: { '/app': appMount('matcher') },
    });

    const verdict = await router.resolve('/app/old-inbox');
    assert.equal(verdict.kind, 'redirect');

    if (verdict.kind === 'redirect') {
      assert.equal(
        mergeSearch(verdict.location, '?q=1'),
        '/app/inbox?page=2&q=1',
      );
    }
  });

  // A fragment reaches a location whenever the redirect target declares a '#'
  // param, which format() documents and RedirectTarget.params accepts. The
  // query has to land BEFORE it: '#' terminates the url, so anything appended
  // past it is fragment text the server never gets back.
  it('keeps the query ahead of a fragment', () => {
    assert.equal(
      mergeSearch('/app/new#section', '?a=1'),
      '/app/new?a=1#section',
    );
  });

  it('merges into a location carrying both a query and a fragment', () => {
    // Regression: splitting on '?' alone parsed 'tab=x#section' as one value,
    // so toString() percent-encoded the '#' into the query (tab=x%23section)
    // and destroyed the fragment outright.
    assert.equal(
      mergeSearch('/app/new?tab=x#section', '?a=1'),
      '/app/new?tab=x&a=1#section',
    );
  });

  it('preserves a fragment that itself contains a question mark', () => {
    assert.equal(mergeSearch('/a#b?c', 'q=1'), '/a?q=1#b?c');
  });

  it('leaves a fragment alone when there is nothing to merge', () => {
    assert.equal(mergeSearch('/a#b', ''), '/a#b');
    assert.equal(mergeSearch('/a?p=1#b', '?p=9'), '/a?p=1#b');
  });

  it('emits no stray "?" when the request search parses to no params', () => {
    // Separators only: non-empty (so no early return) but zero entries, so the
    // merge yields nothing. The location comes back whole — fragment included,
    // which is the arm that re-appends it without a query.
    assert.equal(mergeSearch('/a', '&'), '/a');
    assert.equal(mergeSearch('/a#b', '&'), '/a#b');
  });

  it('carries a fragment through a real redirect verdict', async () => {
    const router = createServerRouter({
      mounts: {
        '/app': {
          routes: [
            { name: 'home', url: '' },
            { name: 'new', url: '/new' },
            {
              name: 'old',
              url: '/old',
              redirectTo: { state: 'new', params: { '#': 'section' } },
            },
          ],
        },
      },
    });

    const verdict = await router.resolve('/app/old');
    assert.equal(verdict.kind, 'redirect');

    if (verdict.kind === 'redirect') {
      assert.equal(verdict.location, '/app/new#section');
      assert.equal(
        mergeSearch(verdict.location, '?a=1'),
        '/app/new?a=1#section',
      );
    }
  });
});
