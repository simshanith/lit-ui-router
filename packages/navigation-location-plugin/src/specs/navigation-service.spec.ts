/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import { NavigationLocationService } from '../index.js';

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
  });
});
