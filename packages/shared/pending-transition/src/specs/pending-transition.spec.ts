import { describe, it, expect } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  Transition,
  UIRouter,
} from '@uirouter/core';

import { routerGo, testStates, tick } from '@tools/lit-test-env/router.ts';
import { trackPending } from '../pending-transition.ts';

function createTestRouter(): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  // Copies: registration binds a declaration to one router, and specs share testStates.
  testStates.forEach((state) => router.stateRegistry.register({ ...state }));

  return router;
}

/** Holds every transition entering `state` until the returned function runs. */
function hold(router: UIRouter, state: string): () => void {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  router.transitionService.onEnter({ entering: state }, () => held);

  return release;
}

function track(router: UIRouter) {
  const writes: (Transition | undefined)[] = [];

  const deregister = trackPending(router, (transition) =>
    writes.push(transition),
  );

  return { writes, deregister, pending: () => writes.at(-1) };
}

describe('trackPending', () => {
  it('writes nothing before any transition', () => {
    const { writes } = track(createTestRouter());

    expect(writes).toEqual([]);
  });

  it('sets the transition on start and clears it on success', async () => {
    const router = createTestRouter();
    const release = hold(router, 'a');
    const { writes, pending } = track(router);

    const done = router.stateService.go('a');
    await tick();
    expect(pending()?.to().name).toBe('a');

    release();
    await done;
    await tick();
    expect(writes.map((t) => t?.to().name)).toEqual(['a', undefined]);
  });

  it('clears it on error', async () => {
    const router = createTestRouter();
    router.transitionService.onEnter({ entering: 'a' }, () => {
      throw new Error('boom');
    });
    router.stateService.defaultErrorHandler(() => {});
    const { writes, pending } = track(router);

    await expect(router.stateService.go('a')).rejects.toThrow();
    await tick();

    expect(writes).toHaveLength(2);
    expect(pending()).toBeUndefined();
  });

  it('clears it on abort', async () => {
    const router = createTestRouter();
    router.transitionService.onEnter({ entering: 'a' }, () => false);
    router.stateService.defaultErrorHandler(() => {});
    const { writes, pending } = track(router);

    await expect(router.stateService.go('a')).rejects.toBeDefined();
    await tick();

    expect(writes).toHaveLength(2);
    expect(pending()).toBeUndefined();
  });

  it('keeps a newer transition pending when a superseded one settles', async () => {
    const router = createTestRouter();
    const releaseA = hold(router, 'a');
    const releaseB = hold(router, 'b');
    const { pending } = track(router);

    const first = router.stateService.go('a');
    await tick();
    const second = router.stateService.go('b', { id: '1' });
    await tick();
    expect(pending()?.to().name).toBe('b');

    releaseA();
    await expect(first).rejects.toBeDefined();
    await tick();
    expect(pending()?.to().name).toBe('b');

    releaseB();
    await second;
    await tick();
    expect(pending()).toBeUndefined();
  });

  it('picks up a transition already running when it attaches', async () => {
    const router = createTestRouter();
    const release = hold(router, 'a');
    const done = router.stateService.go('a');
    await tick();

    const { pending } = track(router);
    expect(pending()?.to().name).toBe('a');

    release();
    await done;
    await tick();
    expect(pending()).toBeUndefined();
  });

  it('ignores a settled transition when it attaches', async () => {
    const router = createTestRouter();
    await routerGo(router, 'a');

    const { writes } = track(router);

    expect(writes).toEqual([]);
  });

  it('stops setting once deregistered', async () => {
    const router = createTestRouter();
    const { writes, deregister } = track(router);
    deregister();

    await routerGo(router, 'a');

    expect(writes).toEqual([]);
  });
});
