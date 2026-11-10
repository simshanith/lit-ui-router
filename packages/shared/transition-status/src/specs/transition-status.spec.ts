import { describe, it, expect } from 'vitest';
import {
  memoryLocationPlugin,
  RejectType,
  servicesPlugin,
  UIRouter,
} from '@uirouter/core';

import { routerGo, testStates, tick } from '@tools/lit-test-env/router.ts';
import {
  trackTransitionStatus,
  type TransitionStatus,
} from '../transition-status.ts';

function createTestRouter(): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  // Copies: registration binds a declaration to one router, and specs share testStates.
  testStates.forEach((state) => router.stateRegistry.register({ ...state }));
  router.stateRegistry.register({
    name: 'fails',
    url: '/fails',
    resolve: [
      {
        token: 'data',
        resolveFn: () => Promise.reject(new Error('boom')),
      },
    ],
  });
  router.stateService.defaultErrorHandler(() => {});

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
  const writes: TransitionStatus[] = [];

  const deregister = trackTransitionStatus(router, (status) =>
    writes.push(status),
  );

  const status = (): TransitionStatus | undefined => writes.at(-1);

  return {
    writes,
    deregister,
    pending: () => status()?.pending,
    error: () => status()?.error,
  };
}

describe('trackTransitionStatus', () => {
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
    expect(writes.map((s) => s.pending?.to().name)).toEqual(['a', undefined]);
    expect(writes.map((s) => s.error)).toEqual([undefined, undefined]);
  });

  it('clears pending and sets the error in one write on an ERROR rejection', async () => {
    const router = createTestRouter();
    const { writes } = track(router);

    await expect(router.stateService.go('fails')).rejects.toBeDefined();
    await tick();

    expect(writes).toHaveLength(2);
    expect(writes[1]?.pending).toBeUndefined();
    expect(writes[1]?.error?.type).toBe(RejectType.ERROR);
    expect(writes[1]?.error?.detail).toEqual(new Error('boom'));
  });

  it('clears pending without an error on abort', async () => {
    const router = createTestRouter();
    router.transitionService.onEnter({ entering: 'a' }, () => false);
    const { writes, pending, error } = track(router);

    await expect(router.stateService.go('a')).rejects.toBeDefined();
    await tick();

    expect(writes).toHaveLength(2);
    expect(pending()).toBeUndefined();
    expect(error()).toBeUndefined();
  });

  it('sets no error for a redirect', async () => {
    const router = createTestRouter();
    router.transitionService.onEnter({ entering: 'b' }, (transition) =>
      transition.router.stateService.target('a'),
    );
    const { writes, error } = track(router);

    await router.stateService.go('b', { id: '1' }).catch(() => {});
    await tick();

    expect(router.globals.current.name).toBe('a');
    // The redirected transition settles before its replacement starts.
    expect(writes.map((s) => s.pending?.to().name)).toEqual([
      'b',
      undefined,
      'a',
      undefined,
    ]);
    expect(writes.map((s) => s.error)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(error()).toBeUndefined();
  });

  it('never sees an ignored or invalid transition', async () => {
    const router = createTestRouter();
    await routerGo(router, 'a');
    const { writes } = track(router);

    // Core resolves an ignored transition with the current state.
    await router.stateService.go('a');
    await expect(router.stateService.go('nowhere')).rejects.toMatchObject({
      type: RejectType.INVALID,
    });
    // Core's onBefore hook rejects invalid params as an ERROR before onStart.
    await expect(
      router.stateService.go('b', { id: undefined }),
    ).rejects.toMatchObject({ type: RejectType.ERROR });
    await tick();

    expect(writes).toEqual([]);
  });

  it('clears the error when the next transition starts', async () => {
    const router = createTestRouter();
    const { error, pending } = track(router);

    await router.stateService.go('fails').catch(() => {});
    await tick();
    expect(error()?.type).toBe(RejectType.ERROR);

    const release = hold(router, 'a');
    const done = router.stateService.go('a');
    await tick();
    expect(pending()?.to().name).toBe('a');
    expect(error()).toBeUndefined();

    release();
    await done;
  });

  it('keeps a newer transition pending when a superseded one settles', async () => {
    const router = createTestRouter();
    const releaseA = hold(router, 'a');
    const releaseB = hold(router, 'b');
    const { pending, error } = track(router);

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
    expect(error()).toBeUndefined();
  });

  it('ignores the late failure of a superseded transition', async () => {
    const router = createTestRouter();
    let fail!: (reason: Error) => void;
    router.transitionService.onEnter(
      { entering: 'a' },
      () => new Promise<void>((_, reject) => (fail = reject)),
    );
    const releaseB = hold(router, 'b');
    const { pending, error } = track(router);

    const first = router.stateService.go('a');
    await tick();
    const second = router.stateService.go('b', { id: '1' });
    await tick();

    fail(new Error('late'));
    await expect(first).rejects.toMatchObject({ type: RejectType.ERROR });
    await tick();
    expect(pending()?.to().name).toBe('b');
    expect(error()).toBeUndefined();

    releaseB();
    await second;
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
