/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
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
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

let stub: StubNavigation;

/**
 * The spec file's "testable subclass" idiom, extended to the seam: reads the
 * stub from module scope so it is available during `super()`, and exposes the
 * protected `_set`.
 */
class TestableService extends NavigationLocationService {
  protected override _navigation(): Navigation {
    return stub as unknown as Navigation;
  }

  testSet(state: unknown, title: string, url: string, replace: boolean): void {
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
    (args: unknown[]) => args[0] === 'navigate',
  ) as [string, (event: NavigateEvent) => void] | undefined;
  if (!call) throw new Error('no navigate listener registered');
  return call[1];
}

interface FakeNavigateEvent {
  canIntercept: boolean;
  info?: unknown;
  intercept: ReturnType<typeof vi.fn>;
}

function fakeNavigateEvent(
  info?: unknown,
  canIntercept = true,
): FakeNavigateEvent {
  return { canIntercept, info, intercept: vi.fn() };
}

describe('NavigationLocationService (stubbed Navigation seam)', () => {
  let router: UIRouter;
  let service: TestableService | null;

  beforeEach(() => {
    stub = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      navigate: vi.fn(() => ({
        committed: Promise.resolve({} as NavigationHistoryEntry),
        finished: Promise.resolve({} as NavigationHistoryEntry),
      })),
    };
    service = null;
  });

  afterEach(() => {
    service?.dispose(router);
    vi.restoreAllMocks();
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

    it('intercepts its own navigation with a resolving handler', async () => {
      const event = fakeNavigateEvent({ uiRouter: router });

      registeredInterceptor()(event as unknown as NavigateEvent);

      expect(event.intercept).toHaveBeenCalledWith({
        handler: expect.any(Function),
      });
      const [{ handler }] = event.intercept.mock.calls[0] as [
        { handler: () => Promise<void> },
      ];
      await expect(handler()).resolves.toBeUndefined();
    });

    it('leaves a navigation it cannot intercept alone', () => {
      const event = fakeNavigateEvent({ uiRouter: router }, false);

      registeredInterceptor()(event as unknown as NavigateEvent);

      expect(event.intercept).not.toHaveBeenCalled();
    });

    it('leaves a navigation it did not start alone', () => {
      const event = fakeNavigateEvent();

      registeredInterceptor()(event as unknown as NavigateEvent);

      expect(event.intercept).not.toHaveBeenCalled();
    });

    it("leaves another router's navigation alone", () => {
      const event = fakeNavigateEvent({ uiRouter: new UIRouter() });

      registeredInterceptor()(event as unknown as NavigateEvent);

      expect(event.intercept).not.toHaveBeenCalled();
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

    it('hands what the option returns to event.intercept', () => {
      const event = fakeNavigateEvent({ uiRouter: router });

      registeredInterceptor()(event as unknown as NavigateEvent);

      expect(intercept).toHaveBeenCalledExactlyOnceWith(event);
      expect(event.intercept).toHaveBeenCalledExactlyOnceWith(interceptOptions);
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

      registeredInterceptor()(event as unknown as NavigateEvent);

      expect(intercept).not.toHaveBeenCalled();
      expect(event.intercept).not.toHaveBeenCalled();
    });
  });

  describe('navigationLocationPlugin', () => {
    it('passes its options to the service it installs', () => {
      const addEventListener = vi.fn();
      vi.spyOn(
        NavigationLocationService.prototype as unknown as {
          _navigation(): Navigation;
        },
        '_navigation',
      ).mockReturnValue({
        addEventListener,
        removeEventListener: vi.fn(),
      } as unknown as Navigation);
      router = createTestRouter();
      const interceptOptions = { handler: async () => {} };
      const intercept = vi.fn(() => interceptOptions);
      const plugin = navigationLocationPlugin(router, { intercept });
      const event = fakeNavigateEvent({ uiRouter: router });

      const call = addEventListener.mock.calls.find(
        (args: unknown[]) => args[0] === 'navigate',
      ) as [string, (event: NavigateEvent) => void];
      call[1](event as unknown as NavigateEvent);

      expect(plugin.service).toBe(router.locationService);
      expect(event.intercept).toHaveBeenCalledExactlyOnceWith(interceptOptions);
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
