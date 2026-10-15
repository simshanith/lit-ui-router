import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRouterPool } from '../src/router-pool.ts';
import type { PooledRouter } from '../src/router-pool.ts';
import { createHeadlessRouter } from '../src/simulate.ts';

const build = () =>
  createHeadlessRouter([
    { name: 'a', url: '/a', redirectTo: { state: 'b', params: { id: '1' } } },
    { name: 'b', url: '/b/:id' },
    {
      name: 'hang',
      url: '/hang',
      resolve: [{ token: 'never', resolveFn: () => new Promise(() => {}) }],
    },
    {
      name: 'boom',
      url: '/boom',
      resolve: [
        { token: 'boom', resolveFn: () => Promise.reject(new Error('boom')) },
      ],
    },
  ]);

const navigate = (pooled: PooledRouter, url: string): Promise<boolean> => {
  const settled = pooled.nextSettled();
  pooled.router.urlService.url(url);
  pooled.router.urlService.sync();

  return settled;
};

describe('createRouterPool', () => {
  it('hands concurrent check-outs distinct routers', () => {
    const pool = createRouterPool();
    const first = pool.checkOut(build);
    const second = pool.checkOut(build);

    assert.notEqual(first.router, second.router);
  });

  it('reuses a released router with fresh globals', async () => {
    const pool = createRouterPool();
    const pooled = pool.checkOut(build);
    assert.equal(await navigate(pooled, '/b/7'), true);
    pooled.release();

    const reused = pool.checkOut(build);
    const { globals, stateRegistry } = reused.router;

    assert.equal(reused, pooled);
    assert.equal(globals.$current, stateRegistry.root());
    assert.equal(globals.current, stateRegistry.root().self);
    assert.deepEqual(Object.keys(globals.params), []);
    assert.equal(globals.successfulTransitions.size(), 0);
    assert.equal(globals.transitionHistory.size(), 0);
  });

  it('drops a router released mid-transition', async () => {
    const pool = createRouterPool();
    const pooled = pool.checkOut(build);
    pooled.router.urlService.url('/hang');
    pooled.router.urlService.sync();
    // The transition starts after core's before-hooks, a microtask later.
    await Promise.resolve();
    assert.ok(pooled.router.globals.transition);
    pooled.release();

    assert.notEqual(pool.checkOut(build), pooled);
  });

  it('settles a redirect on its successor, not the redirected rejection', async () => {
    const pooled = createRouterPool().checkOut(build);

    assert.equal(await navigate(pooled, '/a'), true);
    assert.equal(pooled.router.globals.current.name, 'b');
  });

  it('settles a real failure as false and drops that router on release', async () => {
    const pool = createRouterPool();
    const pooled = pool.checkOut(build);

    assert.equal(await navigate(pooled, '/boom'), false);
    // Settled: nothing is mid-transition, so the failure alone drops it.
    await Promise.resolve();
    assert.equal(pooled.router.globals.transition, null);
    pooled.release();

    assert.notEqual(pool.checkOut(build), pooled);
  });
});
