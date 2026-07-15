import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createServerRouter } from 'ui-router-server';

import { mounts, routes } from '../src/routes.ts';

// The app's contract tests: its own tables, resolved through the package
// API, produce the verdicts the worker will serve. Matching mechanics are
// the package's tests' job; these pin the tables.
const router = createServerRouter({ mounts });

for (const mount of ['/app', '/app-mobx']) {
  describe(`${mount} verdicts`, () => {
    it('serves the shell for static and parameterized routes', async () => {
      for (const path of [
        '/welcome',
        '/home',
        '/login',
        '/prefs',
        '/contacts',
        '/contacts/3',
        '/contacts/3/edit',
        '/contacts/new',
        '/mymessages',
        '/mymessages/compose',
        '/mymessages/inbox',
        '/mymessages/inbox/5',
      ]) {
        assert.deepEqual(
          await router.resolve(`${mount}${path}`),
          { kind: 'shell', mount },
          `${mount}${path}`,
        );
      }
    });

    it('reports notFound for paths no state url matches', async () => {
      // Deliberately NOT the shell-404 projection: flagship 404s stay static
      // pages — byte-identical 404/200 shell bodies read as soft-404s to
      // crawlers, and an SPA booting on missing pages muddies entrance
      // analytics. The /not-found-spa exhibit below demonstrates the other
      // pattern.
      for (const path of [
        '/definitely-not-a-route',
        '/welcome/nope',
        '/welcome/',
        '/welcomeextra',
        '/contacts/3/edit/extra',
        '/mymessages/inbox/5/extra',
      ]) {
        assert.deepEqual(
          await router.resolve(`${mount}${path}`),
          { kind: 'notFound', mount },
          `${mount}${path}`,
        );
      }
    });

    // The slashless pin is counterfactual in production: run_worker_first
    // deliberately excludes bare /app — every docs link uses it, and routing
    // it through the worker would make each one pay a 302 and rewrite
    // hash-mode entries. The verdict is pinned so the exclusion stays a
    // wrangler.jsonc choice, not a package behavior.
    it('redirects the app root to welcome, with and without the slash', async () => {
      for (const path of ['', '/']) {
        assert.deepEqual(
          await router.resolve(`${mount}${path}`),
          {
            kind: 'redirect',
            mount,
            location: `${mount}/welcome`,
            status: 302,
          },
          `${mount}${path}`,
        );
      }
    });

    it('never redirects the redirect target (no self-redirect)', async () => {
      assert.equal((await router.resolve(`${mount}/welcome`)).kind, 'shell');
    });

    it('does not preempt client-conditional redirects (mymessages DSR)', async () => {
      // The client's DSR default and requiresAuth hook compete based on
      // client-side auth state, so the server must not pick a winner.
      assert.deepEqual(await router.resolve(`${mount}/mymessages`), {
        kind: 'shell',
        mount,
      });
    });
  });
}

describe('/app-hash verdicts (the hash-location demo)', () => {
  it('serves the shell at the mount root, with and without the slash', async () => {
    // A hash client keeps the whole route in the fragment, so the server only
    // ever sees the bare mount and must serve the shell there with NO redirect
    // (a 302 would strip the fragment's route on entry — the reason hash mode
    // is not first-class at the flagship mounts). strict:false pins the
    // trailing-slash form to the same shell verdict.
    for (const path of ['', '/']) {
      assert.deepEqual(
        await router.resolve(`/app-hash${path}`),
        { kind: 'shell', mount: '/app-hash' },
        `/app-hash${path}`,
      );
    }
  });

  it('reports notFound for deep paths (a hash client never produces them)', async () => {
    for (const path of ['/welcome', '/contacts/3', '/no/such/route']) {
      assert.deepEqual(
        await router.resolve(`/app-hash${path}`),
        { kind: 'notFound', mount: '/app-hash' },
        `/app-hash${path}`,
      );
    }
  });
});

describe('/not-found-spa verdicts (the not-found-spa exhibit)', () => {
  it('serves the shell at 404 for every path under the mount', async () => {
    // The otherwise projection: the shell IS the error page, at an honest
    // 404 — the client boots at the retained url and renders the in-app
    // notFound state. Even flagship-valid paths 404 here: the mount carries
    // no url-bearing routes, because the shell's baked <base href="/app/">
    // means the client could never match them — a shell-200 would be the
    // soft-404 shape.
    for (const path of ['', '/', '/garbage', '/welcome', '/contacts/3']) {
      assert.deepEqual(
        await router.resolve(`/not-found-spa${path}`),
        { kind: 'shell', mount: '/not-found-spa', status: 404 },
        `/not-found-spa${path}`,
      );
    }
  });
});

describe('/simulated-routing verdicts (the simulate-strategy exhibit)', () => {
  it('is configured to compute verdicts by transition simulation', () => {
    assert.equal(mounts['/simulated-routing'].strategy, 'simulate');
  });

  it('computes the same table-driven verdicts through a headless router', async () => {
    // Same tables as the flagships, replayed through @uirouter/core: the
    // root redirect comes from a real when() rule firing in a transition,
    // the 404 from a real otherwise() settling on the notFound state.
    assert.deepEqual(await router.resolve('/simulated-routing/'), {
      kind: 'redirect',
      mount: '/simulated-routing',
      location: '/simulated-routing/welcome',
      status: 302,
    });
    assert.deepEqual(await router.resolve('/simulated-routing/welcome'), {
      kind: 'shell',
      mount: '/simulated-routing',
    });
    assert.deepEqual(await router.resolve('/simulated-routing/contacts/3'), {
      kind: 'shell',
      mount: '/simulated-routing',
    });
    assert.deepEqual(await router.resolve('/simulated-routing/garbage'), {
      kind: 'shell',
      mount: '/simulated-routing',
      status: 404,
    });
  });
});

describe('mounts', () => {
  it('cover both sample apps with the shared route table, plus the exhibits', () => {
    assert.deepEqual(Object.keys(mounts), [
      '/app',
      '/app-mobx',
      '/app-hash',
      '/not-found-spa',
      '/simulated-routing',
    ]);
    for (const mount of ['/app', '/app-mobx']) {
      assert.equal(mounts[mount].routes, routes);
    }
  });

  it('own nothing outside their bases', async () => {
    for (const path of ['/', '/guides/', '/appx', '/app-mob']) {
      assert.deepEqual(await router.resolve(path), { kind: 'notFound' }, path);
    }
  });

  it("'/app' does not shadow '/app-mobx'", async () => {
    assert.deepEqual(await router.resolve('/app-mobx/welcome'), {
      kind: 'shell',
      mount: '/app-mobx',
    });
  });
});
