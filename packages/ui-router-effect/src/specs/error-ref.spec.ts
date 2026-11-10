import { describe, it, expect } from 'vitest';
import { Effect, SubscriptionRef } from 'effect';
import { RejectType, type StateDeclaration } from '@uirouter/core';

import { errorRef, pendingRef } from '../transition-refs.js';
import { createTestRouter, hold, testStates, tick } from './test-utils.js';

const get = <T>(ref: SubscriptionRef.SubscriptionRef<T>) =>
  Effect.runSync(SubscriptionRef.get(ref));

const failing: StateDeclaration = {
  name: 'fails',
  url: '/fails',
  resolve: [
    { token: 'data', resolveFn: () => Promise.reject(new Error('boom')) },
  ],
};

function createFailingRouter() {
  const router = createTestRouter([...testStates, failing]);
  router.stateService.defaultErrorHandler(() => {});

  return router;
}

describe('errorRef', () => {
  it('holds one ref per router, attached on first use', () => {
    const router = createFailingRouter();
    const other = createFailingRouter();

    expect(errorRef(router)).toBe(errorRef(router));
    expect(errorRef(router)).not.toBe(errorRef(other));
    expect(errorRef(router)).not.toBe(pendingRef(router));
  });

  it('reads undefined before any transition', () => {
    expect(get(errorRef(createFailingRouter()))).toBeUndefined();
  });

  it('is set on an ERROR rejection, as pending clears', async () => {
    const router = createFailingRouter();
    const error = errorRef(router);
    const pending = pendingRef(router);

    const done = router.stateService.go('fails');
    await tick();
    await expect(done).rejects.toBeDefined();
    await tick();

    expect(get(pending)).toBeUndefined();
    expect(get(error)?.type).toBe(RejectType.ERROR);
    expect(get(error)?.detail).toEqual(new Error('boom'));
  });

  it('shares one onStart hook with pendingRef, whichever is used first', async () => {
    const router = createFailingRouter();
    const error = errorRef(router);

    await router.stateService.go('fails').catch(() => {});
    await tick();

    expect(get(pendingRef(router))).toBeUndefined();
    expect(get(error)?.type).toBe(RejectType.ERROR);
  });

  it('is not set by a superseded, redirected, aborted or ignored transition', async () => {
    const router = createFailingRouter();
    const error = errorRef(router);
    router.transitionService.onEnter({ entering: 'b.child' }, () => false);
    router.transitionService.onEnter({ entering: 'b' }, (transition) =>
      transition.params().id === 'redirect'
        ? transition.router.stateService.target('a')
        : undefined,
    );

    const releaseA = hold(router, 'a');
    const superseded = router.stateService.go('a');
    await tick();
    const redirected = router.stateService.go('b', { id: 'redirect' });
    releaseA();
    await expect(superseded).rejects.toMatchObject({
      type: RejectType.SUPERSEDED,
    });
    await redirected.catch(() => {});
    await tick();
    expect(router.globals.current.name).toBe('a');
    expect(get(error)).toBeUndefined();

    await expect(
      router.stateService.go('b.child', { id: '1' }),
    ).rejects.toMatchObject({ type: RejectType.ABORTED });
    await tick();
    expect(get(error)).toBeUndefined();

    await router.stateService.go('a');
    await tick();
    expect(get(error)).toBeUndefined();
  });

  it('is cleared when the next transition starts', async () => {
    const router = createFailingRouter();
    const error = errorRef(router);
    const pending = pendingRef(router);

    await router.stateService.go('fails').catch(() => {});
    await tick();
    expect(get(error)?.type).toBe(RejectType.ERROR);

    const release = hold(router, 'a');
    const retry = router.stateService.go('a');
    await tick();
    expect(get(pending)?.to().name).toBe('a');
    expect(get(error)).toBeUndefined();

    release();
    await retry;
    await tick();
    expect(get(error)).toBeUndefined();
  });

  it('ignores the late failure of a superseded transition', async () => {
    const router = createFailingRouter();
    let fail!: (reason: Error) => void;
    router.transitionService.onEnter(
      { entering: 'a' },
      () => new Promise<void>((_, reject) => (fail = reject)),
    );
    const releaseB = hold(router, 'b');
    const error = errorRef(router);
    const pending = pendingRef(router);

    const first = router.stateService.go('a');
    await tick();
    const second = router.stateService.go('b', { id: '1' });
    await tick();

    fail(new Error('late'));
    await expect(first).rejects.toMatchObject({ type: RejectType.ERROR });
    await tick();
    expect(get(pending)?.to().name).toBe('b');
    expect(get(error)).toBeUndefined();

    releaseB();
    await second;
    await tick();
    expect(get(error)).toBeUndefined();
  });
});
