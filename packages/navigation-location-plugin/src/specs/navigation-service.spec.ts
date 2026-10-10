/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { type LocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { Mock } from 'vitest';
import {
  NavigationLocationService,
  navigationLocationPlugin,
  type NavigationLocationPluginOptions,
} from '../index.js';

// These specs assert what this plugin *passes to* the Navigation API — the
// listener registration, and the arguments of `navigation.navigate()`. They
// used to spy on the real `window.navigation` and therefore booted Chromium to
// call a mock; the `_navigation()` seam lets the same stub sit one layer
// earlier, so they run in happy-dom. Real round-trips through the Navigation
// API stay in index.spec.ts, in the browser project.

interface StubNavigation {
  addEventListener: Mock<
    (type: string, listener: (event: NavigateEvent) => void) => void
  >;
  removeEventListener: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  currentEntry?: NavigationHistoryEntry | null;
}

type NavigationStub = Navigation & StubNavigation;

function navigationStub(fake: StubNavigation): NavigationStub {
  // SAFETY: the service touches only addEventListener, removeEventListener, navigate and currentEntry.
  return fake as NavigationStub;
}

let stub: NavigationStub;

/**
 * The spec file's "testable subclass" idiom, extended to the seam: reads the
 * stub from module scope so it is available during `super()`, and exposes the
 * protected `_set`.
 */
class TestableService extends NavigationLocationService {
  protected override _navigation(): Navigation {
    return stub;
  }

  testSet(
    state: { key: string } | null,
    title: string,
    url: string,
    replace: boolean,
  ): void {
    this._set(state, title, url, replace);
  }
}

function createTestRouter(baseHref = '/'): UIRouter {
  const router = new UIRouter();
  router.urlService.config.baseHref = () => baseHref;

  return router;
}

/** The `navigate` listener the service registered, as the stub recorded it. */
function registeredInterceptor(): (event: NavigateEvent) => void {
  const call = stub.addEventListener.mock.calls.find(
    ([type]) => type === 'navigate',
  );

  if (!call) throw new Error('no navigate listener registered');

  return call[1];
}

/** The `currententrychange` listener the service registered, as the stub recorded it. */
function registeredEntryChangeListener(): (
  event: NavigationCurrentEntryChangeEvent,
) => void {
  const call = stub.addEventListener.mock.calls.find(
    ([type]) => type === 'currententrychange',
  );

  if (!call) throw new Error('no currententrychange listener registered');

  // SAFETY: the stub types every listener as a navigate listener; this one was registered for currententrychange.
  return call[1] as (event: Event) => void;
}

interface FakeCurrentEntryChangeEvent {
  navigationType: NavigationType;
  from: NavigationHistoryEntry;
}

function fakeCurrentEntryChangeEvent(
  fake: FakeCurrentEntryChangeEvent,
): NavigationCurrentEntryChangeEvent {
  // SAFETY: the service reads only navigationType and from off a currententrychange event.
  return fake as NavigationCurrentEntryChangeEvent;
}

interface FakeNavigateEvent {
  canIntercept: boolean;
  info?: unknown;
  intercept: Mock<NavigateEvent['intercept']>;
  navigationType: NavigationType;
  signal: AbortSignal;
}

function fakeNavigateEvent(
  info?: { uiRouter: UIRouter },
  canIntercept = true,
  navigationType: NavigationType = 'push',
  signal = new AbortController().signal,
): NavigateEvent & FakeNavigateEvent {
  const fake: FakeNavigateEvent = {
    canIntercept,
    info,
    intercept: vi.fn<NavigateEvent['intercept']>(),
    navigationType,
    signal,
  };

  // SAFETY: the service reads only canIntercept, info, intercept, navigationType and signal off a navigate event.
  return fake as NavigateEvent & FakeNavigateEvent;
}

describe('NavigationLocationService (stubbed Navigation seam)', () => {
  let router: UIRouter;
  let service: TestableService | null;

  beforeEach(() => {
    stub = navigationStub({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      navigate: vi.fn(() => ({
        committed: Promise.resolve({}),
        finished: Promise.resolve({}),
      })),
    });
    service = null;
  });

  afterEach(() => {
    service?.dispose(router);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('throws without a router instance', () => {
      expect(() => new TestableService()).toThrow(
        'NavigationLocationService requires a UIRouter instance',
      );
    });

    it('creates service with router instance', () => {
      router = createTestRouter();
      service = new TestableService(router);

      expect(service).toBeInstanceOf(NavigationLocationService);
    });

    it('registers currententrychange listener on the Navigation API', () => {
      router = createTestRouter();
      service = new TestableService(router);

      expect(stub.addEventListener).toHaveBeenCalledWith(
        'currententrychange',
        expect.any(Function),
        false,
      );
    });

    it('registers navigate listener on the Navigation API', () => {
      router = createTestRouter();
      service = new TestableService(router);

      expect(stub.addEventListener).toHaveBeenCalledWith(
        'navigate',
        expect.any(Function),
      );
    });

    it('stores config reference from router', () => {
      router = createTestRouter('/app/');
      service = new TestableService(router);

      expect(service._config).toBe(router.urlService.config);
    });
  });

  describe('_set', () => {
    it('calls navigate with the URL, in replace mode, via url()', () => {
      router = createTestRouter('/');
      service = new TestableService(router);

      // BaseLocationServices.url() setter defaults to replace mode
      service.url('/new-path');

      expect(stub.navigate).toHaveBeenCalledWith(
        '/new-path',
        expect.objectContaining({ history: 'replace' }),
      );
    });

    it('includes state in navigate options', () => {
      router = createTestRouter('/');
      service = new TestableService(router);
      const state = { key: 'value' };

      service.testSet(state, 'Test Title', '/path', false);

      expect(stub.navigate).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({ state }),
      );
    });

    it('includes info with uiRouter reference and title', () => {
      router = createTestRouter('/');
      service = new TestableService(router);

      service.testSet(null, 'Page Title', '/path', false);

      expect(stub.navigate).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          info: expect.objectContaining({
            uiRouter: router,
            title: 'Page Title',
          }),
        }),
      );
    });

    it('uses replace history mode when replace=true', () => {
      router = createTestRouter('/');
      service = new TestableService(router);

      service.testSet(null, '', '/path', true);

      expect(stub.navigate).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({ history: 'replace' }),
      );
    });

    it('uses push history mode when replace=false', () => {
      router = createTestRouter('/');
      service = new TestableService(router);

      service.testSet(null, '', '/path', false);

      expect(stub.navigate).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({ history: 'push' }),
      );
    });

    it('composes the full URL from the router baseHref', () => {
      // exhaustive composition cases live in compose-navigate-url.spec.ts;
      // this asserts _set is wired to the router's baseHref
      router = createTestRouter('/app/');
      service = new TestableService(router);

      service.testSet(null, '', 'users', false);

      expect(stub.navigate).toHaveBeenCalledWith(
        '/app/users',
        expect.any(Object),
      );
    });
  });

  describe('navigate interception', () => {
    beforeEach(() => {
      router = createTestRouter();
      service = new TestableService(router);
    });

    it('intercepts its own navigation with a resolving handler and focus left in place', async () => {
      const event = fakeNavigateEvent({ uiRouter: router });

      registeredInterceptor()(event);

      expect(event.intercept).toHaveBeenCalledWith({
        focusReset: 'manual',
        handler: expect.any(Function),
      });

      const [options] = event.intercept.mock.calls[0];

      await expect(options?.handler?.()).resolves.toBeUndefined();
    });

    it('leaves a navigation it cannot intercept alone', () => {
      const event = fakeNavigateEvent({ uiRouter: router }, false);

      registeredInterceptor()(event);

      expect(event.intercept).not.toHaveBeenCalled();
    });

    it('leaves a navigation it did not start alone', () => {
      const event = fakeNavigateEvent();

      registeredInterceptor()(event);

      expect(event.intercept).not.toHaveBeenCalled();
    });

    it("leaves another router's navigation alone", () => {
      const event = fakeNavigateEvent({ uiRouter: new UIRouter() });

      registeredInterceptor()(event);

      expect(event.intercept).not.toHaveBeenCalled();
    });
  });

  describe('currententrychange', () => {
    let onChange: ReturnType<typeof vi.fn<EventListener>>;

    function historyEntry(): NavigationHistoryEntry {
      // SAFETY: the service compares history entries by identity only.
      return {} as NavigationHistoryEntry;
    }

    function dispatch(
      navigationType: NavigationType,
      from: NavigationHistoryEntry,
    ): void {
      registeredEntryChangeListener()(
        fakeCurrentEntryChangeEvent({ navigationType, from }),
      );
    }

    beforeEach(() => {
      router = createTestRouter();
      service = new TestableService(router);
      onChange = vi.fn<EventListener>();
      service.onChange(onChange);
      stub.currentEntry = historyEntry();
    });

    it.each(['push', 'replace', 'traverse'] as const)(
      'notifies listeners of a %s to another entry',
      (navigationType) => {
        dispatch(navigationType, historyEntry());

        expect(onChange).toHaveBeenCalledOnce();
      },
    );

    it('skips a repeated traversal change from the entry it is already on', () => {
      dispatch('traverse', stub.currentEntry!);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('intercept option', () => {
    let interceptOptions: NavigationInterceptOptions;

    let intercept: ReturnType<
      typeof vi.fn<Required<NavigationLocationPluginOptions>['intercept']>
    >;

    beforeEach(() => {
      router = createTestRouter();
      interceptOptions = { handler: async () => {}, scroll: 'manual' };
      intercept = vi.fn(() => interceptOptions);
      service = new TestableService(router, { intercept });
    });

    it('hands what the option returns to event.intercept over a manual focusReset', () => {
      const event = fakeNavigateEvent({ uiRouter: router });

      registeredInterceptor()(event);

      expect(intercept).toHaveBeenCalledExactlyOnceWith(event);
      expect(event.intercept).toHaveBeenCalledExactlyOnceWith({
        focusReset: 'manual',
        ...interceptOptions,
      });
    });

    it('lets the option restore the platform focusReset', () => {
      interceptOptions = { focusReset: 'after-transition' };
      const event = fakeNavigateEvent({ uiRouter: router });

      registeredInterceptor()(event);

      expect(event.intercept).toHaveBeenCalledExactlyOnceWith({
        focusReset: 'after-transition',
      });
    });

    it.each([
      [
        'it cannot intercept',
        () => fakeNavigateEvent({ uiRouter: router }, false),
      ],
      ['it did not start', () => fakeNavigateEvent()],
      [
        "another router's",
        () => fakeNavigateEvent({ uiRouter: new UIRouter() }),
      ],
    ])('is not called for a navigation %s', (_, makeEvent) => {
      const event = makeEvent();

      registeredInterceptor()(event);

      expect(intercept).not.toHaveBeenCalled();
      expect(event.intercept).not.toHaveBeenCalled();
    });
  });

  describe('interceptTraverse option', () => {
    let controller: AbortController;

    function fakeTraverseEvent(
      navigationType: NavigationType = 'traverse',
      info?: { uiRouter: UIRouter },
      canIntercept = true,
    ): NavigateEvent & FakeNavigateEvent {
      return fakeNavigateEvent(
        info,
        canIntercept,
        navigationType,
        controller.signal,
      );
    }

    function interceptedHandler(
      event: FakeNavigateEvent,
    ): NavigationInterceptHandler {
      const handler = event.intercept.mock.calls[0]?.[0]?.handler;

      if (!handler) throw new Error('no handler intercepted');

      return handler;
    }

    beforeEach(() => {
      controller = new AbortController();
      router = createTestRouter();
      router.plugin(servicesPlugin);
    });

    it('leaves traversals alone without the option', () => {
      service = new TestableService(router);
      const event = fakeTraverseEvent();

      registeredInterceptor()(event);

      expect(event.intercept).not.toHaveBeenCalled();
    });

    it('intercepts a traversal with focus left in place when the option is true', async () => {
      service = new TestableService(router, { interceptTraverse: true });
      const event = fakeTraverseEvent();

      registeredInterceptor()(event);

      expect(event.intercept).toHaveBeenCalledExactlyOnceWith({
        focusReset: 'manual',
        handler: expect.any(Function),
      });
      await expect(interceptedHandler(event)()).resolves.toBeUndefined();
    });

    it('merges what the option returns over a manual focusReset and runs its handler after the wait', async () => {
      const handler = vi.fn(async () => {});

      const interceptTraverse = vi.fn(() => ({
        focusReset: 'after-transition' as const,
        scroll: 'manual' as const,
        handler,
      }));

      service = new TestableService(router, { interceptTraverse });
      const event = fakeTraverseEvent();

      registeredInterceptor()(event);

      expect(interceptTraverse).toHaveBeenCalledExactlyOnceWith(event);
      expect(event.intercept).toHaveBeenCalledExactlyOnceWith({
        focusReset: 'after-transition',
        scroll: 'manual',
        handler: expect.any(Function),
      });
      expect(interceptedHandler(event)).not.toBe(handler);
      await interceptedHandler(event)();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('runs the option handler once when the browser calls the handler twice', async () => {
      const handler = vi.fn(async () => {});
      service = new TestableService(router, {
        interceptTraverse: () => ({ handler }),
      });
      const event = fakeTraverseEvent();
      registeredInterceptor()(event);

      const intercepted = interceptedHandler(event);
      await Promise.all([intercepted(), intercepted()]);

      expect(handler).toHaveBeenCalledOnce();
    });

    it.each([
      ['a push', () => fakeTraverseEvent('push')],
      ['a reload', () => fakeTraverseEvent('reload')],
      [
        'a traversal this router started',
        () => fakeTraverseEvent('traverse', { uiRouter: router }),
      ],
      [
        'a traversal it cannot intercept',
        () => fakeTraverseEvent('traverse', undefined, false),
      ],
    ])('is not called for %s', (_, makeEvent) => {
      const interceptTraverse = vi.fn(() => ({}));
      service = new TestableService(router, { interceptTraverse });
      const event = makeEvent();

      registeredInterceptor()(event);

      expect(interceptTraverse).not.toHaveBeenCalled();
    });

    describe('waiting for the router', () => {
      let release: () => void;

      beforeEach(() => {
        const gate = new Promise<void>((resolve) => (release = resolve));
        router.stateRegistry.register({
          name: 'slow',
          resolve: { gate: () => gate },
        });
        router.stateRegistry.register({
          name: 'redirecting',
          redirectTo: 'slow',
        });
      });

      async function settles(promise: Promise<unknown>): Promise<boolean> {
        let settled = false;
        void promise.finally(() => (settled = true));
        await new Promise((resolve) => setTimeout(resolve));

        return settled;
      }

      it.each(['slow', 'redirecting'])(
        'settles once the transition to %s the traversal started settles',
        async (state) => {
          const handler = vi.fn(async () => {});
          router.locationService = service = new TestableService(router, {
            interceptTraverse: () => ({ handler }),
          });
          const event = fakeTraverseEvent();
          registeredInterceptor()(event);
          const done = router.stateService.go(state, {}, { location: false });

          const waiting = Promise.resolve(interceptedHandler(event)());

          expect(await settles(waiting)).toBe(false);
          release();
          await done;
          await waiting;
          expect(router.globals.current.name).toBe('slow');
          expect(handler).toHaveBeenCalledOnce();
        },
      );

      it('stops waiting, without the option handler, when the traversal is aborted', async () => {
        const handler = vi.fn(async () => {});
        router.locationService = service = new TestableService(router, {
          interceptTraverse: () => ({ handler }),
        });
        const event = fakeTraverseEvent();
        registeredInterceptor()(event);
        void router.stateService
          .go('slow', {}, { location: false })
          .catch(() => undefined);

        const waiting = Promise.resolve(interceptedHandler(event)());
        controller.abort();

        await waiting;
        expect(handler).not.toHaveBeenCalled();
        release();
      });

      it('stops watching for transitions when the traversal is aborted before its handler runs', async () => {
        service = new TestableService(router, { interceptTraverse: true });

        const hooks = () =>
          router.transitionService.getHooks('onCreate').length;

        const before = hooks();
        registeredInterceptor()(fakeTraverseEvent());
        expect(hooks()).toBe(before + 1);

        controller.abort();
        await Promise.resolve();

        expect(hooks()).toBe(before);
      });
    });
  });

  describe('navigationLocationPlugin', () => {
    it('passes its options to the service when router.plugin() installs it', () => {
      vi.stubGlobal('navigation', stub);
      router = createTestRouter();
      const interceptOptions = { handler: async () => {} };
      const intercept = vi.fn(() => interceptOptions);

      const plugin = router.plugin<LocationPlugin>(navigationLocationPlugin, {
        intercept,
      });

      const event = fakeNavigateEvent({ uiRouter: router });

      registeredInterceptor()(event);

      expect(plugin.service).toBe(router.locationService);
      expect(event.intercept).toHaveBeenCalledExactlyOnceWith({
        focusReset: 'manual',
        ...interceptOptions,
      });
      plugin.dispose?.(router);
    });
  });

  describe('dispose', () => {
    it('removes the currententrychange event listener', () => {
      router = createTestRouter();
      service = new TestableService(router);

      service.dispose(router);
      service = null;

      expect(stub.removeEventListener).toHaveBeenCalledWith(
        'currententrychange',
        expect.any(Function),
      );
    });

    it('removes the navigate listener it registered', () => {
      router = createTestRouter();
      service = new TestableService(router);
      const interceptor = registeredInterceptor();

      service.dispose(router);
      service = null;

      expect(stub.removeEventListener).toHaveBeenCalledWith(
        'navigate',
        interceptor,
      );
    });
  });
});
