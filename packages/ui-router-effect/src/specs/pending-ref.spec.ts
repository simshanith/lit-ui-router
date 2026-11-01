import { describe, it, expect } from 'vitest';
import { Effect, SubscriptionRef } from 'effect';

import { pendingRef } from '../transition-refs.js';
import { routeRef } from '../route-ref.js';
import { createTestRouter, hold, testStates, tick } from './test-utils.js';

const get = <T>(ref: SubscriptionRef.SubscriptionRef<T>) =>
  Effect.runSync(SubscriptionRef.get(ref));

describe('pendingRef', () => {
  it('holds one ref per router, attached on first use', () => {
    const router = createTestRouter(testStates);
    const other = createTestRouter(testStates);

    expect(pendingRef(router)).toBe(pendingRef(router));
    expect(pendingRef(router)).not.toBe(pendingRef(other));
  });

  it('reads undefined before any transition', () => {
    expect(get(pendingRef(createTestRouter(testStates)))).toBeUndefined();
  });

  it('is set on start and cleared on success', async () => {
    const router = createTestRouter(testStates);
    const release = hold(router, 'a');
    const ref = pendingRef(router);

    const done = router.stateService.go('a');
    await tick();
    expect(get(ref)?.to().name).toBe('a');
    expect(get(routeRef(router)).current?.name).toBe('');

    release();
    await done;
    await tick();
    expect(get(ref)).toBeUndefined();
  });

  it('is cleared on error', async () => {
    const router = createTestRouter(testStates);
    router.stateService.defaultErrorHandler(() => {});
    router.transitionService.onEnter({ entering: 'a' }, () => {
      throw new Error('boom');
    });
    const ref = pendingRef(router);

    await expect(router.stateService.go('a')).rejects.toBeDefined();
    await tick();

    expect(get(ref)).toBeUndefined();
  });

  it('is cleared on abort', async () => {
    const router = createTestRouter(testStates);
    router.stateService.defaultErrorHandler(() => {});
    const release = hold(router, 'a');
    const ref = pendingRef(router);

    const done = router.stateService.go('a');
    await tick();
    expect(get(ref)?.to().name).toBe('a');

    get(ref)?.abort();
    release();
    await expect(done).rejects.toBeDefined();
    await tick();
    expect(get(ref)).toBeUndefined();
  });

  it('a superseded transition does not clear the newer one', async () => {
    const router = createTestRouter(testStates);
    router.stateService.defaultErrorHandler(() => {});
    const releaseA = hold(router, 'a');
    const releaseB = hold(router, 'b');
    const ref = pendingRef(router);

    const first = router.stateService.go('a');
    await tick();
    const second = router.stateService.go('b', { id: '1' });
    await tick();

    releaseA();
    await expect(first).rejects.toBeDefined();
    await tick();
    expect(get(ref)?.to().name).toBe('b');

    releaseB();
    await second;
    await tick();
    expect(get(ref)).toBeUndefined();
  });
});
