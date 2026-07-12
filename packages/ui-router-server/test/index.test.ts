import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createServerRouter } from '../src/index.ts';
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

    it('serves the shell for plain routes', async () => {
      assert.deepEqual(await router.resolve('/app/welcome'), {
        kind: 'shell',
        mount: '/app',
      });
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
