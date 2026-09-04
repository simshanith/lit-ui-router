import { describe, it, expect } from 'vitest';
import { reaction } from 'mobx';

import { RouterStore } from '../router-store.js';
import { createTestRouter, routerGo, testStates } from './test-utils.js';

describe('RouterStore', () => {
  describe('for()', () => {
    it('memoizes one store per router', () => {
      const router = createTestRouter(testStates);
      const store = RouterStore.for(router);
      expect(RouterStore.for(router)).toBe(store);
    });

    it('creates distinct stores for distinct routers', () => {
      const store = RouterStore.for(createTestRouter(testStates));
      const other = RouterStore.for(createTestRouter(testStates));
      expect(other).not.toBe(store);
    });

    it('syncs with the current router state on first use', async () => {
      const router = createTestRouter(testStates);
      await routerGo(router, 'b', { id: '42' });

      const store = RouterStore.for(router);
      expect(store.current?.name).toBe('b');
      expect(store.params.id).toBe('42');
    });
  });

  describe('attach()', () => {
    it('is idempotent for the router already being mirrored', () => {
      const router = createTestRouter(testStates);
      const store = new RouterStore();

      const deregister = store.attach(router);
      expect(store.attach(router)).toBe(deregister);
    });

    it('registers one hook, so the deregistration function detaches', async () => {
      const router = createTestRouter(testStates);
      const store = new RouterStore();

      const deregister = store.attach(router);
      store.attach(router);
      deregister();

      await routerGo(router, 'a');
      expect(store.current?.name).not.toBe('a');
    });

    it('throws when attached to a different router', () => {
      const store = new RouterStore();
      store.attach(createTestRouter(testStates));

      expect(() => store.attach(createTestRouter(testStates))).toThrow(
        /different router/,
      );
    });

    it('can be attached again after detaching, syncing on attach', async () => {
      const router = createTestRouter(testStates);
      const store = new RouterStore();

      const deregister = store.attach(router);
      await routerGo(router, 'a');
      expect(store.current?.name).toBe('a');

      deregister();
      await routerGo(router, 'b', { id: '1' });
      expect(store.current?.name).toBe('a');

      store.attach(router);
      expect(store.current?.name).toBe('b');
    });
  });

  describe('mirroring', () => {
    it('mirrors the current state declaration', async () => {
      const router = createTestRouter(testStates);
      const store = RouterStore.for(router);

      await routerGo(router, 'a');
      expect(store.current?.name).toBe('a');

      await routerGo(router, 'b', { id: '1' });
      expect(store.current?.name).toBe('b');
    });

    it('mirrors the current params, replaced per transition', async () => {
      const router = createTestRouter(testStates);
      const store = RouterStore.for(router);

      await routerGo(router, 'b', { id: '1' });
      const first = store.params;
      expect(first.id).toBe('1');

      await routerGo(router, 'b', { id: '2' });
      expect(store.params.id).toBe('2');
      expect(store.params).not.toBe(first);
    });

    it('mirrors the most recent successful transition', async () => {
      const router = createTestRouter(testStates);
      const store = RouterStore.for(router);

      await routerGo(router, 'a');
      expect(store.transition?.to().name).toBe('a');

      await routerGo(router, 'b', { id: '1' });
      expect(store.transition?.to().name).toBe('b');
    });
  });

  describe('observability', () => {
    it('notifies reactions when the state changes', async () => {
      const router = createTestRouter(testStates);
      const store = RouterStore.for(router);
      const names: (string | undefined)[] = [];

      const dispose = reaction(
        () => store.current?.name,
        (name) => names.push(name),
      );

      await routerGo(router, 'a');
      await routerGo(router, 'b', { id: '1' });
      dispose();

      expect(names).toEqual(['a', 'b']);
    });

    it('includes() is observable and supports glob patterns', async () => {
      const router = createTestRouter(testStates);
      const store = RouterStore.for(router);
      const values: boolean[] = [];

      const dispose = reaction(
        () => store.includes('b.**'),
        (value) => values.push(value),
      );

      expect(store.includes('b.**')).toBe(false);
      await routerGo(router, 'b.child', { id: '1' });
      await routerGo(router, 'a');
      dispose();

      expect(values).toEqual([true, false]);
    });
  });
});
