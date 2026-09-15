import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  expectTypeOf,
  vi,
} from 'vitest';
import { html } from 'lit';
import { servicesPlugin, UIRouter } from '@uirouter/core';

import {
  adoptUiViewContext,
  contextRequestEventName,
  isRouterContextRequest,
  parentUiViewContext,
  provideContext,
  provideRouter,
  requestContext,
  requestRouter,
  routerContext,
  RouterContextRequestEvent,
  getScopedRouter,
  withRouterSync,
  type Context,
  type ContextCallback,
} from '../context.js';
import { UiView } from '../ui-view.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../ui-router.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

/** A provider that records subscribers, so later answers can be replayed. */
function provideRecordingRouter(
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
      provideRecordingRouter(container, router);

      expect(requestRouter(host)).toBe(router);
    });

    it('returns undefined when no provider answers', () => {
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      expect(requestRouter(orphan)).toBeUndefined();
    });

    it('reaches a provider on a plain EventTarget', () => {
      const root = new EventTarget();
      provideRecordingRouter(root, router);

      expect(requestRouter(root)).toBe(router);
    });

    it('stops at the nearest provider', () => {
      const outer = createTestRouter();
      const inner = document.createElement('div');
      const leaf = document.createElement('div');
      container.appendChild(inner);
      inner.appendChild(leaf);
      provideRecordingRouter(container, outer);
      provideRecordingRouter(inner, router);

      expect(requestRouter(leaf)).toBe(router);
    });

    it('forwards every answer and the unsubscribe to the callback', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const unsubscribe = vi.fn();
      const { subscribers } = provideRecordingRouter(
        container,
        router,
        unsubscribe,
      );
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
      const { subscribers } = provideRecordingRouter(container, router);
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
      provideRecordingRouter(container, router);

      expect(UIRouterLitElement.seekRouter(child)).toBe(router);
    });

    it('still returns undefined with no provider of either kind', () => {
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      expect(UIRouterLitElement.seekRouter(orphan)).toBeUndefined();
    });
  });

  describe('<ui-view> as a parent-view provider', () => {
    /** Mounts a view under a `<ui-router>`, past its own content capture. */
    async function mountView(deferHydration = false): Promise<UiView> {
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);
      const view = document.createElement('ui-view');
      if (deferHydration) view.setAttribute('defer-hydration', '');
      uiRouterEl.appendChild(view);
      await waitForUpdate(uiRouterEl);
      return view;
    }

    /** Routes to a nested state, so the inner `<ui-view>` is a real routed child. */
    async function mountNestedViews(): Promise<{
      view: UiView;
      nested: UiView;
      leaf: HTMLElement;
    }> {
      router = createTestRouter([
        {
          name: 'parent',
          url: '/parent',
          component: () => html`<div class="parent"><ui-view></ui-view></div>`,
        },
        {
          name: 'parent.child',
          url: '/child',
          component: () => html`<div class="leaf">leaf</div>`,
        },
      ]);
      const view = await mountView();
      router.start();
      await routerGo(router, 'parent.child');
      await tick(50);

      const nested = view.querySelector('ui-view')!;
      const leaf = nested.querySelector('.leaf') as HTMLElement;
      return { view, nested, leaf };
    }

    it('answers a context-request from a descendant', async () => {
      const view = await mountView();
      const child = document.createElement('div');
      view.appendChild(child);

      expect(requestContext(child, parentUiViewContext)).toBe(view);
    });

    it('answers a nested view with its parent, never itself', async () => {
      const { view, nested } = await mountNestedViews();

      expect(requestContext(nested, parentUiViewContext)).toBe(view);
    });

    it('returns undefined with no enclosing view', async () => {
      await mountView();
      const orphan = document.createElement('div');
      container.appendChild(orphan);

      expect(requestContext(orphan, parentUiViewContext)).toBeUndefined();
    });

    it('stops the request, so an outer view never answers twice', async () => {
      const { nested, leaf } = await mountNestedViews();
      const answers: UiView[] = [];

      requestContext(leaf, parentUiViewContext, {
        callback: (value) => answers.push(value),
      });

      expect(answers).toEqual([nested]);
    });

    it('stops answering once disconnected', async () => {
      const view = await mountView();
      const child = document.createElement('div');
      view.appendChild(child);
      view.remove();
      container.appendChild(child);

      expect(requestContext(child, parentUiViewContext)).toBeUndefined();
    });

    it('answers a subscribing request once, with a no-op unsubscribe', async () => {
      const view = await mountView();
      const child = document.createElement('div');
      view.appendChild(child);
      const callback = vi.fn();

      requestContext(child, parentUiViewContext, {
        subscribe: true,
        callback,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const unsubscribe = callback.mock.calls[0][1];
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });

    it('answers while asleep under defer-hydration', async () => {
      const view = await mountView(true);
      const child = document.createElement('div');
      view.appendChild(child);

      expect(view.hasUpdated).toBe(false);
      expect(requestContext(child, parentUiViewContext)).toBe(view);
    });

    it('keeps the house ui-view-context seek resolving the same parent', async () => {
      const { view, nested } = await mountNestedViews();

      expect(UiView.seekParentView(nested)).toBe(view);
      expect(requestContext(nested, parentUiViewContext)).toBe(view);
    });
  });
});

describe('provideRouter', () => {
  it('answers a context request that reaches the root', () => {
    const root = new EventTarget();
    const router = new UIRouterLit();
    const uninstall = provideRouter(root, router);

    expect(requestRouter(root)).toBe(router);

    uninstall();
    expect(requestRouter(root)).toBeUndefined();
  });

  it('answers a request that bubbles up from a descendant element', () => {
    const router = new UIRouterLit();
    const uninstall = provideRouter(document.body, router);
    const child = document.createElement('span');
    document.body.append(child);

    expect(requestRouter(child)).toBe(router);

    uninstall();
    child.remove();
  });

  it('hands a subscriber a no-op unsubscribe, and a one-shot caller none', () => {
    const root = new EventTarget();
    const router = new UIRouterLit();
    const uninstall = provideRouter(root, router);
    const answers: (string | undefined)[] = [];

    requestRouter(root, {
      subscribe: true,
      callback: (_router, unsubscribe) => answers.push(typeof unsubscribe),
    });
    requestRouter(root, {
      callback: (_router, unsubscribe) => answers.push(typeof unsubscribe),
    });

    expect(answers).toEqual(['function', 'undefined']);
    uninstall();
  });

  it('answers exactly once when two providers share a root', () => {
    const root = new EventTarget();
    const outer = new UIRouterLit();
    const inner = new UIRouterLit();
    const uninstallOuter = provideRouter(root, outer);
    const uninstallInner = provideRouter(root, inner);
    const seen: UIRouterLit[] = [];

    requestRouter(root, { callback: (router) => seen.push(router) });

    // stopImmediatePropagation: the first listener on the target is the only one
    expect(seen).toEqual([outer]);
    uninstallOuter();
    uninstallInner();
  });

  it('uninstalls only the listener its own call installed', () => {
    const root = new EventTarget();
    const first = new UIRouterLit();
    const second = new UIRouterLit();
    const uninstallFirst = provideRouter(root, first);
    const uninstallSecond = provideRouter(root, second);

    uninstallFirst();
    expect(requestRouter(root)).toBe(second);
    uninstallSecond();
  });
});

describe('provideContext', () => {
  type SpecKey = Context<{ readonly name: string }, string>;

  const key = Object.freeze({ name: 'spec#key' }) as SpecKey;
  const otherKey = Object.freeze({ name: 'spec#other' }) as SpecKey;

  /** A minimal protocol request for `key`, shaped as a provider reads it. */
  function request(
    target: EventTarget,
    requested: SpecKey,
    options: { subscribe?: boolean } = {},
  ): { answers: string[]; unsubscribes: (undefined | (() => void))[] } {
    const answers: string[] = [];
    const unsubscribes: (undefined | (() => void))[] = [];
    const event = Object.assign(new Event(contextRequestEventName), {
      context: requested,
      callback: (value: string, unsubscribe?: () => void) => {
        answers.push(value);
        unsubscribes.push(unsubscribe);
      },
      subscribe: options.subscribe,
    });
    target.dispatchEvent(event);
    return { answers, unsubscribes };
  }

  it('answers requests for its own key and ignores others', () => {
    const root = new EventTarget();
    const uninstall = provideContext(root, key, 'value');

    expect(request(root, key).answers).toEqual(['value']);
    expect(request(root, otherKey).answers).toEqual([]);

    uninstall();
    expect(request(root, key).answers).toEqual([]);
  });

  it('hands a subscriber a no-op unsubscribe, and a one-shot caller none', () => {
    const root = new EventTarget();
    const uninstall = provideContext(root, key, 'value');

    const subscribed = request(root, key, { subscribe: true });
    const once = request(root, key);

    expect(typeof subscribed.unsubscribes[0]).toBe('function');
    expect(once.unsubscribes[0]).toBeUndefined();
    uninstall();
  });

  it('answers exactly once when two providers share a root', () => {
    const root = new EventTarget();
    const uninstallOuter = provideContext(root, key, 'outer');
    const uninstallInner = provideContext(root, key, 'inner');

    // stopImmediatePropagation: the first listener on the target is the only one
    expect(request(root, key).answers).toEqual(['outer']);
    uninstallOuter();
    uninstallInner();
  });

  it('uninstalls only the listener its own call installed', () => {
    const root = new EventTarget();
    const uninstallFirst = provideContext(root, key, 'first');
    const uninstallSecond = provideContext(root, key, 'second');

    uninstallFirst();
    expect(request(root, key).answers).toEqual(['second']);
    uninstallSecond();
  });
});

describe('requestContext', () => {
  type SpecKey = Context<{ readonly name: string }, string>;

  const key = Object.freeze({ name: 'spec#request' }) as SpecKey;
  const otherKey = Object.freeze({ name: 'spec#request-other' }) as SpecKey;

  it('returns the value a provider answers its key with', () => {
    const root = new EventTarget();
    const uninstall = provideContext(root, key, 'value');

    expect(requestContext(root, key)).toBe('value');

    uninstall();
  });

  it('returns undefined when nobody answers', () => {
    const root = new EventTarget();
    const uninstall = provideContext(root, otherKey, 'value');

    expect(requestContext(root, key)).toBeUndefined();

    uninstall();
  });

  it('returns the first answer when several arrive', () => {
    const root = new EventTarget();
    const listener = (event: Event) => {
      const request = event as Event & {
        callback: ContextCallback<string>;
        context: SpecKey;
      };
      if (request.context !== key) return;
      request.callback('first');
      request.callback('second');
    };
    root.addEventListener(contextRequestEventName, listener);

    expect(requestContext(root, key)).toBe('first');

    root.removeEventListener(contextRequestEventName, listener);
  });

  it('forwards every answer to the callback', () => {
    const root = new EventTarget();
    const seen: string[] = [];
    const listener = (event: Event) => {
      const request = event as Event & {
        callback: ContextCallback<string>;
        context: SpecKey;
      };
      if (request.context !== key) return;
      request.callback('first');
      request.callback('second');
    };
    root.addEventListener(contextRequestEventName, listener);

    requestContext(root, key, { callback: (value) => seen.push(value) });

    expect(seen).toEqual(['first', 'second']);
    root.removeEventListener(contextRequestEventName, listener);
  });

  it('forwards subscribe to the provider', () => {
    const root = new EventTarget();
    const uninstall = provideContext(root, key, 'value');
    const unsubscribes: (undefined | (() => void))[] = [];

    requestContext(root, key, {
      subscribe: true,
      callback: (_value, unsubscribe) => unsubscribes.push(unsubscribe),
    });
    requestContext(root, key, {
      callback: (_value, unsubscribe) => unsubscribes.push(unsubscribe),
    });

    expect(unsubscribes.map((it) => typeof it)).toEqual([
      'function',
      'undefined',
    ]);
    uninstall();
  });
});

describe('adoptUiViewContext', () => {
  it('is a frozen object, so the key is stable and unique', () => {
    expect(Object.isFrozen(adoptUiViewContext)).toBe(true);
    expect(adoptUiViewContext.name).toBe('lit-ui-router/context#adopt-ui-view');
  });

  it('carries the adopter from a provider to a requester', () => {
    const root = new EventTarget();
    const view = document.createElement('div') as unknown as UiView;
    const adopt = vi.fn();
    const uninstall = provideContext(root, adoptUiViewContext, adopt);

    requestContext(root, adoptUiViewContext)?.(view);

    expect(adopt).toHaveBeenCalledWith(view);
    uninstall();
    expect(requestContext(root, adoptUiViewContext)).toBeUndefined();
  });
});

describe('withRouterSync', () => {
  it('is undefined outside any call', () => {
    expect(getScopedRouter()).toBeUndefined();
  });

  it('publishes the router for the duration of run and returns its value', () => {
    const router = new UIRouterLit();

    const seen = withRouterSync(router, () => getScopedRouter());

    expect(seen).toBe(router);
    expect(getScopedRouter()).toBeUndefined();
  });

  it('nests, restoring the outer router on the way out', () => {
    const outer = new UIRouterLit();
    const inner = new UIRouterLit();
    const trace: (UIRouter | undefined)[] = [];

    withRouterSync(outer, () => {
      trace.push(getScopedRouter());
      withRouterSync(inner, () => trace.push(getScopedRouter()));
      trace.push(getScopedRouter());
    });

    expect(trace).toEqual([outer, inner, outer]);
    expect(getScopedRouter()).toBeUndefined();
  });

  it('restores the slot when run throws', () => {
    const router = new UIRouterLit();

    expect(() =>
      withRouterSync(router, () => {
        throw new Error('render failed');
      }),
    ).toThrow('render failed');
    expect(getScopedRouter()).toBeUndefined();
  });

  it('throws on a thenable, with the slot already restored', () => {
    const router = new UIRouterLit();
    const pending = Promise.resolve('markup');

    expect(() => withRouterSync(router, () => pending)).toThrow(TypeError);
    expect(() => withRouterSync(router, () => pending)).toThrow(
      /collectResultSync/,
    );
    expect(getScopedRouter()).toBeUndefined();
    return pending;
  });
});

describe('the router types the hand-off takes', () => {
  const coreRouter = (): UIRouter => {
    const router = new UIRouter();
    router.plugin(servicesPlugin);
    return router;
  };

  it('scopes a plain @uirouter/core router', () => {
    const router = coreRouter();

    expectTypeOf(router).toEqualTypeOf<UIRouter>();
    expectTypeOf(getScopedRouter()).toEqualTypeOf<UIRouter | undefined>();
    expect(withRouterSync(router, () => getScopedRouter())).toBe(router);
  });

  it('answers the context key with a UIRouterLit, which is what it promises', () => {
    expectTypeOf(provideRouter).parameter(1).toEqualTypeOf<UIRouterLit>();
  });
});
