import { describe, it, expect } from 'vitest';
import { Signal } from 'signal-polyfill';

import { RouterSignals } from '../router-signals.js';
import { watchSelection } from '../watch.js';
import { createTestRouter, routerGo, testStates } from './test-utils.js';

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
});
