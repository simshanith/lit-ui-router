import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import worker from '../index.ts';

// The docs worker's HTTP contract, exercised on the production code path: the
// real module (real sample-app-routes mounts, real ui-router-server fetch
// adapter, the worker's own shell aliasing / noindex / 404-page policy) with
// only the assets binding mocked. Which ASSET PATH the worker fetches is the
// assertion that replaces the old Cypress body-title checks — the built
// bodies themselves stay covered by the docs suite's cy.visit smokes.
const ORIGIN = 'http://docs.test';

// Stand-ins for docs/dist: the three shell builds, the flagship 404 pages,
// and a default that plays the binding's own 404.html handling.
const ASSET_TABLE: Record<string, { body: string; headers: HeadersInit }> = {
  '/app': { body: 'vanilla-shell', headers: { 'Content-Type': 'text/html' } },
  '/app-mobx': { body: 'mobx-shell', headers: { 'Content-Type': 'text/html' } },
  '/app-hash': { body: 'hash-shell', headers: { 'Content-Type': 'text/html' } },
  '/app/404.html': {
    body: 'vanilla-404-page',
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  },
  '/app-mobx/404.html': {
    body: 'mobx-404-page',
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  },
};

// The worker feeds the binding Requests (shell, pass-through) and bare URLs
// (the 404-page probe), so normalize both.
const pathnameOf = (input: Request | URL | string): string =>
  new URL(input instanceof Request ? input.url : String(input)).pathname;

let assetCalls: string[] = [];
beforeEach(() => {
  assetCalls = [];
});

const env = {
  ASSETS: {
    fetch: (input: Request | URL | string) => {
      const pathname = pathnameOf(input);
      assetCalls.push(pathname);
      const asset = ASSET_TABLE[pathname];
      return Promise.resolve(
        asset
          ? new Response(asset.body, { status: 200, headers: asset.headers })
          : new Response('binding-404-page', {
              status: 404,
              headers: { 'Content-Type': 'text/html' },
            }),
      );
    },
  },
} as unknown as Parameters<typeof worker.fetch>[1];

// Plain GETs, like the Cypress cy.request calls these tests replace; the
// worker judges every request it receives (shouldHandle: () => true — it only
// runs for the run_worker_first prefixes).
const dispatch = (path: string) =>
  worker.fetch(new Request(`${ORIGIN}${path}`), env);

describe('flagship mounts (/app, /app-mobx)', () => {
  it('serves each mount its own shell at 200 for real routes, indexable', async () => {
    for (const mount of ['/app', '/app-mobx']) {
      for (const path of ['/welcome', '/contacts/1/edit']) {
        assetCalls = [];
        const res = await dispatch(`${mount}${path}`);
        assert.equal(res.status, 200, `${mount}${path}`);
        // The flagship serves its OWN build (mobx bindings differ) — the old
        // cy title check ("(MobX)" suffix) becomes the shell asset path.
        assert.deepEqual(assetCalls, [mount], `${mount}${path}`);
        assert.equal(await res.text(), ASSET_TABLE[mount].body);
        // A matched route is canonical at the shell; flagships are indexable.
        assert.equal(res.headers.get('Link'), `<${mount}>; rel="canonical"`);
        assert.equal(res.headers.get('X-Robots-Tag'), null, `${mount}${path}`);
      }
    }
  });

  it('302s the mount root to /welcome — hash mode is not first-class there', async () => {
    for (const mount of ['/app', '/app-mobx']) {
      const res = await dispatch(mount);
      assert.equal(res.status, 302, mount);
      assert.equal(res.headers.get('Location'), `${mount}/welcome`, mount);
      assert.equal(res.headers.get('X-Robots-Tag'), null, mount);
    }
  });

  it('serves the per-app 404 page, re-wrapped at an honest 404', async () => {
    for (const mount of ['/app', '/app-mobx']) {
      for (const path of [
        '/definitely-not-a-route',
        '/contacts/1/edit/extra',
      ]) {
        assetCalls = [];
        const res = await dispatch(`${mount}${path}`);
        assert.equal(res.status, 404, `${mount}${path}`);
        // The miss is mount-owned: the worker asked for that app's 404 page.
        assert.deepEqual(assetCalls, [`${mount}/404.html`]);
        assert.equal(await res.text(), ASSET_TABLE[`${mount}/404.html`].body);
        // The page's own headers ride along (content-type included) …
        assert.match(
          res.headers.get('Content-Type') ?? '',
          /text\/html/,
          `${mount}${path}`,
        );
        // … but not a route, so no canonical Link, and still indexable.
        assert.equal(res.headers.get('Link'), null, `${mount}${path}`);
        assert.equal(res.headers.get('X-Robots-Tag'), null, `${mount}${path}`);
      }
    }
  });
});

describe('/app-hash (the hash-location demo)', () => {
  it('serves its own shell at 200 at the root, with no redirect', async () => {
    // The fragment carries the route: a 302 at the bare mount would strip it
    // on entry, so both root forms must answer 200 with the hash shell.
    for (const path of ['/app-hash', '/app-hash/']) {
      assetCalls = [];
      const res = await dispatch(path);
      assert.equal(res.status, 200, path);
      assert.deepEqual(assetCalls, ['/app-hash'], path);
      assert.equal(await res.text(), ASSET_TABLE['/app-hash'].body);
      assert.equal(res.headers.get('Location'), null, path);
      assert.equal(res.headers.get('X-Robots-Tag'), null, path);
    }
  });

  it('answers an honest 404 for deep paths a hash client never produces', async () => {
    const res = await dispatch('/app-hash/no/such/route');
    assert.equal(res.status, 404);
  });
});

describe('/not-found-naive (the soft-404 exhibit)', () => {
  it('serves the vanilla shell at 200 for everything, noindexed', async () => {
    // No routing at all — the classic SPA-host fallback, bypassing the
    // router. Every response is the aliased vanilla shell at a lying 200;
    // noindex quarantines the anti-pattern from crawlers.
    for (const path of [
      '/not-found-naive',
      '/not-found-naive/anything/at/all',
      '/not-found-naive/definitely-not-a-route',
    ]) {
      assetCalls = [];
      const res = await dispatch(path);
      assert.equal(res.status, 200, path);
      assert.deepEqual(assetCalls, ['/app'], path);
      assert.equal(await res.text(), ASSET_TABLE['/app'].body);
      assert.equal(res.headers.get('X-Robots-Tag'), 'noindex', path);
    }
  });
});

describe('/not-found-spa (the honest-404 SPA exhibit)', () => {
  it('302s the mount root to its welcome, noindexed', async () => {
    const res = await dispatch('/not-found-spa');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/not-found-spa/welcome');
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  });

  it('serves the aliased vanilla shell at 200 for real routes', async () => {
    for (const path of ['/welcome', '/contacts/1/edit']) {
      assetCalls = [];
      const res = await dispatch(`/not-found-spa${path}`);
      assert.equal(res.status, 200, path);
      // The exhibit has no build of its own: the mount-agnostic vanilla
      // shell serves here (shellPath aliasing), deriving its base at boot.
      assert.deepEqual(assetCalls, ['/app'], path);
      assert.equal(await res.text(), ASSET_TABLE['/app'].body);
      assert.equal(res.headers.get('X-Robots-Tag'), 'noindex', path);
    }
  });

  it('serves the shell at an honest 404 for genuine misses', async () => {
    for (const path of ['/not-found-spa/any/path', '/not-found-spa/nope']) {
      assetCalls = [];
      const res = await dispatch(path);
      assert.equal(res.status, 404, path);
      // The body IS the app shell (the `otherwise` projection — a status'd
      // shell), not a static 404 page; a 404 carries no canonical Link.
      assert.deepEqual(assetCalls, ['/app'], path);
      assert.equal(await res.text(), ASSET_TABLE['/app'].body);
      assert.equal(res.headers.get('Link'), null, path);
      assert.equal(res.headers.get('X-Robots-Tag'), 'noindex', path);
    }
  });
});

describe('/simulated-routing (the simulate-strategy exhibit)', () => {
  it('302s the root with the request search merged into the Location', async () => {
    const res = await dispatch('/simulated-routing/?flag=1');
    assert.equal(res.status, 302);
    assert.equal(
      res.headers.get('Location'),
      '/simulated-routing/welcome?flag=1',
    );
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  });

  it('serves the aliased vanilla shell at 200 for a computed match', async () => {
    const res = await dispatch('/simulated-routing/welcome');
    assert.equal(res.status, 200);
    assert.deepEqual(assetCalls, ['/app']);
    assert.equal(await res.text(), ASSET_TABLE['/app'].body);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  });

  it('serves the shell at an honest 404 for a computed miss', async () => {
    const res = await dispatch('/simulated-routing/garbage');
    assert.equal(res.status, 404);
    assert.deepEqual(assetCalls, ['/app']);
    assert.equal(await res.text(), ASSET_TABLE['/app'].body);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  });
});

describe('outside the mounts', () => {
  it('passes a mountless path straight through to the assets binding', async () => {
    // In production the worker never sees these (run_worker_first scopes it
    // to the mounts); if one ever reaches it, the binding still answers.
    const res = await dispatch('/guides/');
    assert.deepEqual(assetCalls, ['/guides/']);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('X-Robots-Tag'), null);
  });
});
