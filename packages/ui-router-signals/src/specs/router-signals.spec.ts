import { describe, it, expect } from 'vitest';
import { Signal } from 'signal-polyfill';
import { RejectType, type StateDeclaration } from '@uirouter/core';

import { RouterSignals } from '../router-signals.js';
import { watchSelection } from '../watch.js';
import {
  createTestRouter,
  hold,
  routerGo,
  testStates,
  tick,
} from './test-utils.js';

/** A pending state name and an error type, as one observation. */
type Seen = [string | undefined, RejectType | undefined];

const failing: StateDeclaration = {
  name: 'fails',
  url: '/fails',
  resolve: [
    { token: 'data', resolveFn: () => Promise.reject(new Error('boom')) },
  ],
};

describe('RouterSignals', () => {
  describe('for()', () => {
    it('memoizes one instance per router', () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);
      expect(RouterSignals.for(router)).toBe(signals);
    });

    it('creates distinct instances for distinct routers', () => {
      const signals = RouterSignals.for(createTestRouter(testStates));
      const other = RouterSignals.for(createTestRouter(testStates));
      expect(other).not.toBe(signals);
    });

    it('syncs with the current router state on first use', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'b', { id: '42' });

      const signals = RouterSignals.for(router);
      expect(signals.current.get()?.name).toBe('b');
      expect(signals.params.get().id).toBe('42');
    });
  });

  describe('attach()', () => {
    it('is idempotent for the router already being mirrored', () => {
      const router = createTestRouter(testStates);
      const signals = new RouterSignals();

      const deregister = signals.attach(router);
      expect(signals.attach(router)).toBe(deregister);
    });

    it('registers one hook, so the deregistration function detaches', async () => {
      const router = createTestRouter(testStates);
      const signals = new RouterSignals();

      const deregister = signals.attach(router);
      signals.attach(router);
      deregister();

      await routerGo(router, 'a');
      expect(signals.current.get()?.name).not.toBe('a');
    });

    it('throws when attached to a different router', () => {
      const signals = new RouterSignals();
      signals.attach(createTestRouter(testStates));

      expect(() => signals.attach(createTestRouter(testStates))).toThrow(
        /different router/,
      );
    });

    it('can be attached again after detaching, syncing on attach', async () => {
      const router = createTestRouter(testStates);
      const signals = new RouterSignals();

      const deregister = signals.attach(router);
      await routerGo(router, 'a');
      expect(signals.current.get()?.name).toBe('a');

      deregister();
      await routerGo(router, 'b', { id: '1' });
      expect(signals.current.get()?.name).toBe('a');

      signals.attach(router);
      expect(signals.current.get()?.name).toBe('b');
    });
  });

  describe('mirroring', () => {
    it('mirrors the current state declaration', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);

      await routerGo(router, 'a');
      expect(signals.current.get()?.name).toBe('a');

      await routerGo(router, 'b', { id: '1' });
      expect(signals.current.get()?.name).toBe('b');
    });

    it('mirrors the current params, replaced per transition', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);

      await routerGo(router, 'b', { id: '1' });
      const first = signals.params.get();
      expect(first.id).toBe('1');

      await routerGo(router, 'b', { id: '2' });
      expect(signals.params.get().id).toBe('2');
      expect(signals.params.get()).not.toBe(first);
    });

    it('mirrors the most recent successful transition', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);

      await routerGo(router, 'a');
      expect(signals.transition.get()?.to().name).toBe('a');

      await routerGo(router, 'b', { id: '1' });
      expect(signals.transition.get()?.to().name).toBe('b');
    });
  });

  describe('tracking', () => {
    it('notifies watchers when the state changes', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);
      const names: (string | undefined)[] = [];

      const stop = watchSelection(
        () => signals.current.get()?.name,
        undefined,
        (name) => names.push(name),
      );

      await routerGo(router, 'a');
      await routerGo(router, 'b', { id: '1' });
      stop();

      // '' is the root state, current before the first transition.
      expect(names).toEqual(['', 'a', 'b']);
    });

    it('does not notify current-only readers on a params-only transition', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);
      await routerGo(router, 'b', { id: '1' });

      let runs = 0;

      const name = new Signal.Computed(() => {
        runs++;

        return signals.current.get()?.name;
      });

      const stop = watchSelection(
        () => name.get(),
        undefined,
        () => {},
      );

      const runsBefore = runs;

      await routerGo(router, 'b', { id: '2' });
      stop();

      // The computed re-checks its source, but the declaration is the same
      // object, so its value (and its downstream) stays put.
      expect(name.get()).toBe('b');
      expect(runs).toBe(runsBefore);
    });

    it('includes() is tracked and supports glob patterns', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);
      const values: boolean[] = [];

      const stop = watchSelection(
        () => signals.includes('b.**'),
        undefined,
        (value) => values.push(value),
      );

      await routerGo(router, 'b.child', { id: '1' });
      await routerGo(router, 'a');
      stop();

      expect(values).toEqual([false, true, false]);
    });
  });

  describe('snapshot', () => {
    it('exposes the whole route as one value per transition', async () => {
      const router = createTestRouter(testStates);
      const signals = RouterSignals.for(router);
      const before = signals.route.get();

      await routerGo(router, 'b', { id: '1' });

      const route = signals.route.get();
      expect(route).not.toBe(before);
      expect(route.current?.name).toBe('b');
      expect(route.params.id).toBe('1');
      expect(route.includes('b', { id: '1' })).toBe(true);
    });

    it('includes() answers for the settled route, not the in-flight one', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'a');
      const signals = new RouterSignals();
      let seen: [live: boolean, settled: boolean] | undefined;
      // Registered first, so it runs before the RouterSignals hook writes b.
      router.transitionService.onSuccess({}, () => {
        seen = [router.stateService.includes('b'), signals.includes('b')];
      });
      signals.attach(router);

      await routerGo(router, 'b', { id: '1' });

      expect(seen).toEqual([true, false]);
      expect(signals.includes('b')).toBe(true);
    });

    it('answers false while detached', () => {
      const signals = new RouterSignals();

      expect(signals.includes('')).toBe(false);
      expect(signals.current.get()).toBeUndefined();
    });
  });

  describe('pending', () => {
    it('reads undefined before any transition', () => {
      const signals = RouterSignals.for(createTestRouter(testStates));

      expect(signals.pending.get()).toBeUndefined();
    });

    it('is set on start and cleared on success', async () => {
      const router = createTestRouter(testStates);
      const release = hold(router, 'a');
      const signals = RouterSignals.for(router);
      const names: (string | undefined)[] = [];

      const stop = watchSelection(
        () => signals.pending.get()?.to().name,
        undefined,
        (name) => names.push(name),
      );

      const done = router.stateService.go('a');
      await tick();
      expect(signals.pending.get()?.to().name).toBe('a');
      expect(signals.current.get()?.name).toBe('');

      release();
      await done;
      await tick();
      stop();

      expect(signals.pending.get()).toBeUndefined();
      expect(names).toEqual([undefined, 'a', undefined]);
    });

    it('is cleared on error', async () => {
      const router = createTestRouter(testStates);
      router.stateService.defaultErrorHandler(() => {});
      router.transitionService.onEnter({ entering: 'a' }, () => {
        throw new Error('boom');
      });
      const signals = RouterSignals.for(router);

      const done = router.stateService.go('a');
      await tick();
      await expect(done).rejects.toBeDefined();
      await tick();

      expect(signals.pending.get()).toBeUndefined();
    });

    it('is cleared on abort', async () => {
      const router = createTestRouter(testStates);
      router.stateService.defaultErrorHandler(() => {});
      router.transitionService.onEnter({ entering: 'a' }, () => false);
      const signals = RouterSignals.for(router);
      const names: (string | undefined)[] = [];

      const stop = watchSelection(
        () => signals.pending.get()?.to().name,
        undefined,
        (name) => names.push(name),
      );

      await expect(router.stateService.go('a')).rejects.toBeDefined();
      await tick();
      stop();

      expect(names).toEqual([undefined, 'a', undefined]);
    });

    it('a superseded transition does not clear the newer one', async () => {
      const router = createTestRouter(testStates);
      router.stateService.defaultErrorHandler(() => {});
      const releaseA = hold(router, 'a');
      const releaseB = hold(router, 'b');
      const signals = RouterSignals.for(router);

      const first = router.stateService.go('a');
      await tick();
      const second = router.stateService.go('b', { id: '1' });
      await tick();

      releaseA();
      await expect(first).rejects.toBeDefined();
      await tick();
      expect(signals.pending.get()?.to().name).toBe('b');

      releaseB();
      await second;
      await tick();
      expect(signals.pending.get()).toBeUndefined();
      expect(signals.current.get()?.name).toBe('b');
    });

    it('stops tracking once detached', async () => {
      const router = createTestRouter(testStates);
      const signals = new RouterSignals();
      signals.attach(router)();

      const release = hold(router, 'a');
      const done = router.stateService.go('a');
      await tick();
      expect(signals.pending.get()).toBeUndefined();

      release();
      await done;
    });
  });

  describe('error', () => {
    function createFailingRouter() {
      const router = createTestRouter([...testStates, failing]);
      router.stateService.defaultErrorHandler(() => {});

      return router;
    }

    it('reads undefined before any transition', () => {
      const signals = RouterSignals.for(createFailingRouter());

      expect(signals.error.get()).toBeUndefined();
    });

    it('is set on an ERROR rejection, as pending clears', async () => {
      const router = createFailingRouter();
      const signals = RouterSignals.for(router);
      const seen: Seen[] = [];

      const select = (): Seen => [
        signals.pending.get()?.to().name,
        signals.error.get()?.type,
      ];

      const stop = watchSelection(
        select,
        (a, b) => a[0] === b[0] && a[1] === b[1],
        (pair) => seen.push(pair),
      );

      await expect(router.stateService.go('fails')).rejects.toBeDefined();
      await tick();
      stop();

      expect(signals.error.get()?.detail).toEqual(new Error('boom'));
      expect(seen).toEqual([
        [undefined, undefined],
        ['fails', undefined],
        [undefined, RejectType.ERROR],
      ]);
    });

    it('is not set by a superseded, redirected, aborted or ignored transition', async () => {
      const router = createFailingRouter();
      const signals = RouterSignals.for(router);
      router.transitionService.onEnter({ entering: 'b.child' }, () => false);
      router.transitionService.onEnter({ entering: 'b' }, (transition) =>
        transition.params().id === 'redirect'
          ? transition.router.stateService.target('a')
          : undefined,
      );
      const errors: unknown[] = [];

      const stop = watchSelection(
        () => signals.error.get(),
        undefined,
        (error) => errors.push(error),
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
      expect(signals.current.get()?.name).toBe('a');

      await expect(
        router.stateService.go('b.child', { id: '1' }),
      ).rejects.toMatchObject({ type: RejectType.ABORTED });
      await router.stateService.go('a');
      await tick();
      stop();

      expect(errors).toEqual([undefined]);
    });

    it('is cleared when the next transition starts', async () => {
      const router = createFailingRouter();
      const signals = RouterSignals.for(router);

      await router.stateService.go('fails').catch(() => {});
      await tick();
      expect(signals.error.get()?.type).toBe(RejectType.ERROR);

      const release = hold(router, 'a');
      const retry = router.stateService.go('a');
      await tick();
      expect(signals.pending.get()?.to().name).toBe('a');
      expect(signals.error.get()).toBeUndefined();

      release();
      await retry;
      await tick();
      expect(signals.error.get()).toBeUndefined();
    });

    it('ignores the late failure of a superseded transition', async () => {
      const router = createFailingRouter();
      let fail!: (reason: Error) => void;
      router.transitionService.onEnter(
        { entering: 'a' },
        () => new Promise<void>((_, reject) => (fail = reject)),
      );
      const releaseB = hold(router, 'b');
      const signals = RouterSignals.for(router);

      const first = router.stateService.go('a');
      await tick();
      const second = router.stateService.go('b', { id: '1' });
      await tick();

      fail(new Error('late'));
      await expect(first).rejects.toMatchObject({ type: RejectType.ERROR });
      await tick();
      expect(signals.pending.get()?.to().name).toBe('b');
      expect(signals.error.get()).toBeUndefined();

      releaseB();
      await second;
      await tick();
      expect(signals.error.get()).toBeUndefined();
    });
  });
});
