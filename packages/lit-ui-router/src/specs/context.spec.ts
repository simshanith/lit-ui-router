import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  contextRequestEventName,
  isRouterContextRequest,
  requestRouter,
  routerContext,
  RouterContextRequestEvent,
  type ContextCallback,
} from '../context.js';
import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../ui-router.js';
import { createTestRouter, waitForUpdate } from './test-utils.js';

/** A provider written against the protocol alone — no @lit/context, no elements. */
function provideRouter(
  host: EventTarget,
  router: UIRouterLit,
  unsubscribe: () => void = () => {},
): { listener: EventListener; subscribers: ContextCallback<UIRouterLit>[] } {
  const subscribers: ContextCallback<UIRouterLit>[] = [];
  const listener = (event: Event) => {
    if (!isRouterContextRequest(event)) return;
    event.stopImmediatePropagation();
    if (event.subscribe) subscribers.push(event.callback);
    event.callback(router, event.subscribe ? unsubscribe : undefined);
  };
  host.addEventListener(contextRequestEventName, listener);
  return { listener, subscribers };
}

describe('lit-ui-router/context', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter();
  });

  afterEach(() => {
    container.remove();
  });

  describe('routerContext', () => {
    it('is a frozen object, so the key is stable and unique', () => {
      expect(typeof routerContext).toBe('object');
      expect(Object.isFrozen(routerContext)).toBe(true);
      expect(routerContext.name).toBe('lit-ui-router/context#router');
      expect(new RouterContextRequestEvent(() => {}).context).toBe(
        routerContext,
      );
    });
  });

  describe('RouterContextRequestEvent', () => {
    it('carries the protocol event name, key and flags', () => {
      const event = new RouterContextRequestEvent(() => {}, true);

      expect(event.type).toBe('context-request');
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.context).toBe(routerContext);
      expect(event.subscribe).toBe(true);
    });

    it('leaves subscribe undefined when it was not asked for', () => {
      expect(new RouterContextRequestEvent(() => {}).subscribe).toBeUndefined();
    });
  });

  describe('isRouterContextRequest', () => {
    it('accepts a request for the router context', () => {
      expect(
        isRouterContextRequest(new RouterContextRequestEvent(() => {})),
      ).toBe(true);
    });

    it('rejects a request for another key', () => {
      const event = Object.assign(new Event(contextRequestEventName), {
        context: { name: 'someone-else' },
        callback: () => {},
      });

      expect(isRouterContextRequest(event)).toBe(false);
    });

    it('rejects another event type', () => {
      expect(isRouterContextRequest(new Event('ui-router-context'))).toBe(
        false,
      );
    });
  });

  describe('requestRouter', () => {
    it('returns the value a provider supplies synchronously', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      provideRouter(container, router);

      expect(requestRouter(host)).toBe(router);
    });

    it('returns undefined when no provider answers', () => {
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      expect(requestRouter(orphan)).toBeUndefined();
    });

    it('reaches a provider on a plain EventTarget', () => {
      const root = new EventTarget();
      provideRouter(root, router);

      expect(requestRouter(root)).toBe(router);
    });

    it('stops at the nearest provider', () => {
      const outer = createTestRouter();
      const inner = document.createElement('div');
      const leaf = document.createElement('div');
      container.appendChild(inner);
      inner.appendChild(leaf);
      provideRouter(container, outer);
      provideRouter(inner, router);

      expect(requestRouter(leaf)).toBe(router);
    });

    it('forwards every answer and the unsubscribe to the callback', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const unsubscribe = vi.fn();
      const { subscribers } = provideRouter(container, router, unsubscribe);
      const callback = vi.fn();

      const answer = requestRouter(host, { subscribe: true, callback });

      expect(answer).toBe(router);
      expect(callback).toHaveBeenCalledWith(router, unsubscribe);

      const next = createTestRouter();
      subscribers[0](next, unsubscribe);

      expect(callback).toHaveBeenLastCalledWith(next, unsubscribe);
      // the synchronous answer is the return value; later ones are the callback's
      expect(answer).toBe(router);
    });

    it('asks for no subscription by default, so no unsubscribe is offered', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const { subscribers } = provideRouter(container, router);
      const callback = vi.fn();

      requestRouter(host, { callback });

      expect(subscribers).toHaveLength(0);
      expect(callback).toHaveBeenCalledWith(router, undefined);
    });
  });

  describe('<ui-router> as a provider', () => {
    it('answers a context-request from a descendant', async () => {
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      const child = document.createElement('div');
      element.appendChild(child);

      expect(requestRouter(child)).toBe(router);
    });

    it('answers a subscribing request once, with a no-op unsubscribe', async () => {
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      const child = document.createElement('div');
      element.appendChild(child);
      const callback = vi.fn();

      requestRouter(child, { subscribe: true, callback });

      expect(callback).toHaveBeenCalledTimes(1);
      const unsubscribe = callback.mock.calls[0][1];
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });

    it('stops the request, so an outer provider never sees it', async () => {
      const outer = vi.fn();
      container.addEventListener(contextRequestEventName, outer);

      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);
      const child = document.createElement('div');
      element.appendChild(child);

      expect(requestRouter(child)).toBe(router);
      expect(outer).not.toHaveBeenCalled();
    });

    it('ignores a context-request for another key, letting it bubble', async () => {
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);
      const child = document.createElement('div');
      element.appendChild(child);
      const outer = vi.fn();
      container.addEventListener(contextRequestEventName, outer);

      const event = Object.assign(
        new Event(contextRequestEventName, { bubbles: true, composed: true }),
        { context: { name: 'someone-else' }, callback: () => {} },
      );
      child.dispatchEvent(event);

      expect(outer).toHaveBeenCalledTimes(1);
    });

    it('keeps the house ui-router-context path working unchanged', async () => {
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      const child = document.createElement('div');
      element.appendChild(child);

      expect(UIRouterLitElement.seekRouter(child)).toBe(router);
    });

    it('answers only once per connect, however often it reconnects', async () => {
      const element = document.createElement('ui-router');
      element.uiRouter = router;
      container.appendChild(element);
      await waitForUpdate(element);

      element.remove();
      container.appendChild(element);
      await waitForUpdate(element);

      const child = document.createElement('div');
      element.appendChild(child);
      const callback = vi.fn();

      requestRouter(child, { callback });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('seekRouter falls back to the protocol', () => {
    it('finds a router from a protocol provider ancestor', () => {
      const child = document.createElement('div');
      container.appendChild(child);
      provideRouter(container, router);

      expect(UIRouterLitElement.seekRouter(child)).toBe(router);
    });

    it('still returns undefined with no provider of either kind', () => {
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      expect(UIRouterLitElement.seekRouter(orphan)).toBeUndefined();
    });
  });
});
