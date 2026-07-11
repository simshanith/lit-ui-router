import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createHeadlessRouter, onceSettled } from '../src/headless.ts';
import { computeAppRedirect, createAppRouter } from '../src/simulate.ts';

describe('computeAppRedirect', () => {
  it('redirects the app root to the projected welcome url', async () => {
    assert.equal(await computeAppRedirect('/'), '/welcome');
    assert.equal(await computeAppRedirect(''), '/welcome');
  });

  it('returns null for a plain route', async () => {
    assert.equal(await computeAppRedirect('/home'), null);
    assert.equal(await computeAppRedirect('/welcome'), null);
  });

  it('returns null for parameterized deep links', async () => {
    assert.equal(await computeAppRedirect('/contacts/3'), null);
    assert.equal(await computeAppRedirect('/mymessages/inbox/5'), null);
  });

  it('returns null for unknown paths', async () => {
    assert.equal(await computeAppRedirect('/nope'), null);
    assert.equal(await computeAppRedirect('/contacts/3/nope'), null);
  });

  it('does not preempt client-conditional redirects (mymessages DSR)', async () => {
    // The client's DSR default and requiresAuth hook compete based on
    // client-side auth state, so the server must not pick a winner.
    assert.equal(await computeAppRedirect('/mymessages'), null);
  });

  it('registers no otherwise() rule, so unknowns cannot become 302s', () => {
    const router = createAppRouter();
    const unmatched = router.urlService.match({
      path: '/definitely-not-a-route',
      search: {},
      hash: '',
    });
    assert.equal(unmatched, null);
  });
});

describe('onceSettled', () => {
  it('waits out a superseded redirect chain for the final transition', async () => {
    const router = createHeadlessRouter([
      { name: 'a', url: '/a', redirectTo: 'b' },
      { name: 'b', url: '/b' },
    ]);
    const settled = onceSettled(router);
    router.urlService.url('/a');
    router.urlService.sync();
    assert.equal(await settled, true);
    assert.equal(router.globals.current.name, 'b');
    // A redirect from a url-sourced transition replaces the address.
    assert.equal(router.urlService.url(), '/b');
  });

  it('reports non-redirect failures as false', async () => {
    const router = createHeadlessRouter([
      {
        name: 'boom',
        url: '/boom',
        resolve: [
          { token: 'x', resolveFn: () => Promise.reject(new Error('boom')) },
        ],
      },
    ]);
    const settled = onceSettled(router);
    router.urlService.url('/boom');
    router.urlService.sync();
    assert.equal(await settled, false);
  });
});
