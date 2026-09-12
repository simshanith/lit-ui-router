import { describe, it, expect } from 'vitest';
import { Effect, SubscriptionRef } from 'effect';

import { routeRef, snapshotRoute } from '../route-ref.js';
import { createTestRouter, routerGo, testStates } from './test-utils.js';

const get = <T>(ref: SubscriptionRef.SubscriptionRef<T>) =>
  Effect.runSync(SubscriptionRef.get(ref));

describe('routeRef', () => {
  it('holds one ref per router, attached on first use', () => {
    const router = createTestRouter(testStates);
    const other = createTestRouter(testStates);

    expect(routeRef(router)).toBe(routeRef(router));
    expect(routeRef(router)).not.toBe(routeRef(other));
  });

  it('starts from the current route and follows successful transitions', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');
    const ref = routeRef(router);

    expect(get(ref).current?.name).toBe('a');
    expect(get(ref).transition?.to().name).toBe('a');

    await routerGo(router, 'b', { id: '1' });

    const route = get(ref);
    expect(route.current?.name).toBe('b');
    expect(route.params.id).toBe('1');
    expect(route.transition?.to().name).toBe('b');
  });

  it('is a fresh value per transition, not a mutated one', async () => {
    const router = createTestRouter(testStates);
    const ref = routeRef(router);
    await routerGo(router, 'a');
    const before = get(ref);

    await routerGo(router, 'b', { id: '1' });

    expect(get(ref)).not.toBe(before);
    expect(before.current?.name).toBe('a');
    expect(before.params.id).toBeUndefined();
  });
});

describe('RouteSnapshot.includes', () => {
  it('matches the active state, its ancestors, and globs', async () => {
    const router = createTestRouter(testStates);
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
    const router = createTestRouter(testStates);
    await routerGo(router, 'b.child', { id: '1' });
    const route = snapshotRoute(router);

    expect(route.includes('b', { id: '1' })).toBe(true);
    expect(route.includes('b', { id: '2' })).toBe(false);
  });

  it('answers for the snapshot, not the router', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');
    const route = snapshotRoute(router);

    await routerGo(router, 'b', { id: '1' });

    expect(route.includes('a')).toBe(true);
    expect(route.includes('b')).toBe(false);
    expect(router.stateService.includes('b')).toBe(true);
  });
});
