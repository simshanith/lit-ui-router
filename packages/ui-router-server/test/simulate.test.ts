import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { StateDeclaration } from '@uirouter/core';

import { createHeadlessRouter, onceSettled } from '../src/simulate.ts';

// Drives a fresh router through one url-sourced transition and reports where
// the memory location landed — the worker-side replay in miniature.
async function settleUrl(path: string): Promise<string | null> {
  const router = createHeadlessRouter([
    { name: 'a', url: '/a', redirectTo: 'b' },
    { name: 'b', url: '/b' },
    { name: 'plain', url: '/plain' },
  ]);

  const settled = onceSettled(router);
  router.urlService.url(path);
  router.urlService.sync();

  if (!(await settled)) return null;

  return router.urlService.url();
}

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

describe('createHeadlessRouter', () => {
  it('builds path-shaped hrefs, as a pushState client does', () => {
    const router = createHeadlessRouter([
      { name: 'sheet', url: '/sheet/:num' },
    ]);

    assert.equal(router.stateService.href('sheet', { num: '7B' }), '/sheet/7B');
  });
});

describe('per-call state declarations', () => {
  // The regression this pins: each call builds its router from fresh
  // declaration objects, so concurrent calls cannot observe each other
  // through core's registration-time mutations or the memory location.
  it('isolates concurrent routers', async () => {
    const results = await Promise.all([
      settleUrl('/a'),
      settleUrl('/plain'),
      settleUrl('/a'),
    ]);

    assert.deepEqual(results, ['/b', '/plain', '/b']);
  });
});

describe('shared state declarations', () => {
  // Core stamps $$state on what it registers; a later router must not repoint the first router's lazy resolves.
  it('isolates routers built concurrently from one array', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const states: StateDeclaration[] = [
      { name: 'home', url: '/' },
      {
        name: 'parent',
        url: '/parent',
        resolve: [{ token: 'gate', resolveFn: () => gate }],
      },
      {
        name: 'parent.child',
        url: '/child',
        resolve: [{ token: 'leaf', resolveFn: () => 'leaf' }],
      },
    ];

    const first = createHeadlessRouter(states);
    const firstSettled = onceSettled(first);
    first.urlService.url('/parent/child');
    first.urlService.sync();

    const second = createHeadlessRouter(states);
    const secondSettled = onceSettled(second);
    second.urlService.url('/parent/child');
    second.urlService.sync();
    release();

    assert.deepEqual(await Promise.all([firstSettled, secondSettled]), [
      true,
      true,
    ]);
    assert.equal(first.globals.current.name, 'parent.child');
    assert.equal(second.globals.current.name, 'parent.child');
  });
});
