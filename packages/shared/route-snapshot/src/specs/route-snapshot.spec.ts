import { describe, it, expect } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { routerGo, testStates } from '@tools/lit-test-env/router.ts';
import { snapshotRoute } from '../route-snapshot.ts';

function createTestRouter(): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  // Copies: registration binds a declaration to one router, and specs share testStates.
  testStates.forEach((state) => router.stateRegistry.register({ ...state }));

  return router;
}

describe('snapshotRoute', () => {
  it('captures the current state, params and transition', async () => {
    const router = createTestRouter();
    await routerGo(router, 'b', { id: '1' });
    const route = snapshotRoute(router);

    expect(route.current?.name).toBe('b');
    expect(route.params.id).toBe('1');
    expect(route.transition?.to().name).toBe('b');
  });

  it('takes the transition it is given', async () => {
    const router = createTestRouter();
    await routerGo(router, 'a');
    const first = router.globals.successfulTransitions.peekTail();
    await routerGo(router, 'b', { id: '1' });

    expect(snapshotRoute(router, first).transition).toBe(first);
  });

  it('copies params instead of aliasing the live object', async () => {
    const router = createTestRouter();
    await routerGo(router, 'b', { id: '1' });
    const route = snapshotRoute(router);

    await routerGo(router, 'b', { id: '2' });

    expect(route.params.id).toBe('1');
    expect(route.params).not.toBe(router.globals.params);
  });
});

describe('RouteSnapshot.includes', () => {
  it('matches the active state, its ancestors, and globs', async () => {
    const router = createTestRouter();
    await routerGo(router, 'b.child', { id: '1' });
    const route = snapshotRoute(router);

    expect(route.includes('b.child')).toBe(true);
    expect(route.includes('b')).toBe(true);
    expect(route.includes('b.**')).toBe(true);
    expect(route.includes('a')).toBe(false);
    expect(route.includes('a.**')).toBe(false);
    expect(route.includes('nope')).toBe(false);
  });

  it('compares parameter values', async () => {
    const router = createTestRouter();
    await routerGo(router, 'b.child', { id: '1' });
    const route = snapshotRoute(router);

    expect(route.includes('b', { id: '1' })).toBe(true);
    expect(route.includes('b', { id: '2' })).toBe(false);
  });

  it('answers for the snapshot, not the router', async () => {
    const router = createTestRouter();
    await routerGo(router, 'a');
    const route = snapshotRoute(router);

    await routerGo(router, 'b', { id: '1' });

    expect(route.includes('a')).toBe(true);
    expect(route.includes('b')).toBe(false);
    expect(router.stateService.includes('b')).toBe(true);
  });
});
