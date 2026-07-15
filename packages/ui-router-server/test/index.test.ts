import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createServerRouter, mergeSearch } from '../src/index.ts';
import type { MountConfig } from '../src/index.ts';

const appMount = (strategy: MountConfig['strategy']): MountConfig => ({
  strategy,
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
for (const strategy of ['matcher', 'simulate'] as const) {
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
const appMountWith404 = (strategy: MountConfig['strategy']): MountConfig => {
  const mount = appMount(strategy);
  return {
    ...mount,
    routes: [...mount.routes, { name: 'notFound' }],
    otherwise: { state: 'notFound' },
  };
};

for (const strategy of ['matcher', 'simulate'] as const) {
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
});

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
});
