import { describe, it, expect } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { snapshotRoute } from '../route-snapshot.js';
import { routerGo, testStates } from '@tools/lit-test-env/router.ts';

// A bare UIRouter: the entry needs nothing from lit or UIRouterLit.
const createRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  testStates.forEach((state) => router.stateRegistry.register({ ...state }));
  return router;
};

describe('snapshotRoute', () => {
  it('starts at the root state before the first transition', () => {
    const route = snapshotRoute(createRouter());

    expect(route.current?.name).toBe('');
    expect(route.transition).toBeUndefined();
    expect(route.includes('a')).toBe(false);
  });

  it('records the current state, params and latest successful transition', async () => {
    const router = createRouter();
    await routerGo(router, 'b', { id: '1' });

    const route = snapshotRoute(router);

    expect(route.current?.name).toBe('b');
    expect(route.params.id).toBe('1');
    expect(route.transition).toBe(
      router.globals.successfulTransitions.peekTail(),
    );
  });

  it('records the transition it is handed', async () => {
    const router = createRouter();
    let handed: unknown;
    router.transitionService.onSuccess({}, (transition) => {
      handed = snapshotRoute(router, transition).transition;
    });

    await routerGo(router, 'a');

    expect(handed).toBe(router.globals.successfulTransitions.peekTail());
  });

  it('is a fresh value per call, with params copied off the router', async () => {
    const router = createRouter();
    await routerGo(router, 'a');
    const before = snapshotRoute(router);

    await routerGo(router, 'b', { id: '1' });

    expect(snapshotRoute(router)).not.toBe(before);
    expect(before.params).not.toBe(router.globals.params);
    expect(before.current?.name).toBe('a');
    expect(before.params.id).toBeUndefined();
  });
});

describe('RouteSnapshot.includes', () => {
  it('matches the active state, its ancestors, and globs', async () => {
    const router = createRouter();
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
    const router = createRouter();
    await routerGo(router, 'b.child', { id: '1' });
    const route = snapshotRoute(router);

    expect(route.includes('b', { id: '1' })).toBe(true);
    expect(route.includes('b', { id: '2' })).toBe(false);
  });

  it('answers for the snapshot, not the router', async () => {
    const router = createRouter();
    await routerGo(router, 'a');
    const route = snapshotRoute(router);

    await routerGo(router, 'b', { id: '1' });

    expect(route.includes('a')).toBe(true);
    expect(route.includes('b')).toBe(false);
    expect(router.stateService.includes('b')).toBe(true);
  });
});
