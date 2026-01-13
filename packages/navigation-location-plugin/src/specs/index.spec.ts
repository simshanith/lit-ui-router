/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import {
  NavigationLocationService,
  navigationLocationPlugin,
  isUIRouterNavigateEvent,
} from '../index.js';

/**
 * Check if the Navigation API is available in this browser.
 * The Navigation API is only supported in Chromium-based browsers.
 */
const hasNavigationAPI =
  typeof window !== 'undefined' && 'navigation' in window;

/**
 * Creates a minimal UIRouter instance for testing.
 */
function createTestRouter(baseHref = '/'): UIRouter {
  const router = new UIRouter();
  // Configure the base href
  router.urlService.config.baseHref = () => baseHref;
  return router;
}

describe('isUIRouterNavigateEvent', () => {
  it('returns true for events with valid UIRouter instance in info', () => {
    const router = new UIRouter();
    const event = {
      info: { uiRouter: router },
    } as unknown as NavigateEvent;

    expect(isUIRouterNavigateEvent(event)).toBe(true);
  });

  it('returns false for events without info', () => {
    const event = {} as NavigateEvent;
    expect(isUIRouterNavigateEvent(event)).toBe(false);
  });

  it('returns false for events with non-UIRouter info', () => {
    const event = {
      info: { uiRouter: {} },
    } as unknown as NavigateEvent;

    expect(isUIRouterNavigateEvent(event)).toBe(false);
  });

  it('returns false for events with null info', () => {
    const event = {
      info: null,
    } as unknown as NavigateEvent;

    expect(isUIRouterNavigateEvent(event)).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isUIRouterNavigateEvent(undefined)).toBe(false);
  });
});

// Navigation API tests - only run in browsers that support it (Chromium-based)
describe.skipIf(!hasNavigationAPI)('NavigationLocationService', () => {
  let router: UIRouter;
  let service: NavigationLocationService;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on Navigation API methods and prevent actual navigation
    addEventListenerSpy = vi.spyOn(window.navigation, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window.navigation, 'removeEventListener');
    navigateSpy = vi
      .spyOn(window.navigation, 'navigate')
      .mockImplementation(() => ({
        committed: Promise.resolve({} as NavigationHistoryEntry),
        finished: Promise.resolve({} as NavigationHistoryEntry),
      }));
  });

  afterEach(() => {
    // Clean up
    if (service) {
      service.dispose(router);
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates service with router instance', () => {
      router = createTestRouter();
      service = new NavigationLocationService(router);

      expect(service).toBeInstanceOf(NavigationLocationService);
    });

    it('registers currententrychange listener on Navigation API', () => {
      router = createTestRouter();
      service = new NavigationLocationService(router);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'currententrychange',
        expect.any(Function),
        false,
      );
    });

    it('stores config reference from router', () => {
      router = createTestRouter('/app/');
      service = new NavigationLocationService(router);

      expect(service._config).toBe(router.urlService.config);
    });
  });

  describe('_get (via url())', () => {
    // Note: Testing _get() requires controlling the browser location,
    // which we can't do without actually navigating (which breaks tests).
    // Instead, we test the behavior through the service.url() method
    // by verifying the initial URL reading works.

    it('reads current URL from browser location', () => {
      router = createTestRouter('/');
      service = new NavigationLocationService(router);

      // The service should return a string representing the current URL
      const url = service.url();
      expect(typeof url).toBe('string');
    });
  });

  describe('_set (via url() setter and testable subclass)', () => {
    it('calls navigation.navigate with correct URL', () => {
      router = createTestRouter('/');
      service = new NavigationLocationService(router);

      service.url('/new-path');

      // Note: BaseLocationServices.url() setter uses replace mode by default
      expect(navigateSpy).toHaveBeenCalledWith(
        '/new-path',
        expect.objectContaining({
          history: 'replace',
        }),
      );
    });

    it('includes state in navigate options', () => {
      router = createTestRouter('/');

      // Create a testable subclass to access protected _set method
      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      const state = { key: 'value' };

      testService.testSet(state, 'Test Title', '/path', false);

      expect(navigateSpy).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          state,
        }),
      );

      testService.dispose(router);
      // Prevent afterEach from disposing again
      service = null!;
    });

    it('includes info with uiRouter reference and title', () => {
      router = createTestRouter('/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, 'Page Title', '/path', false);

      expect(navigateSpy).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          info: expect.objectContaining({
            uiRouter: router,
            title: 'Page Title',
          }),
        }),
      );

      testService.dispose(router);
      service = null!;
    });

    it('uses replace history mode when replace=true', () => {
      router = createTestRouter('/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, '', '/path', true);

      expect(navigateSpy).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          history: 'replace',
        }),
      );

      testService.dispose(router);
      service = null!;
    });

    it('uses push history mode when replace=false', () => {
      router = createTestRouter('/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, '', '/path', false);

      expect(navigateSpy).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          history: 'push',
        }),
      );

      testService.dispose(router);
      service = null!;
    });

    it('handles empty URL by using baseHref', () => {
      router = createTestRouter('/app/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, '', '', false);

      expect(navigateSpy).toHaveBeenCalledWith('/app/', expect.any(Object));

      testService.dispose(router);
      service = null!;
    });

    it('handles root URL (/) by using baseHref', () => {
      router = createTestRouter('/app/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, '', '/', false);

      expect(navigateSpy).toHaveBeenCalledWith('/app/', expect.any(Object));

      testService.dispose(router);
      service = null!;
    });

    it('prepends base prefix to non-root URLs', () => {
      router = createTestRouter('/app/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, '', '/users', false);

      expect(navigateSpy).toHaveBeenCalledWith(
        '/app/users',
        expect.any(Object),
      );

      testService.dispose(router);
      service = null!;
    });

    it('adds leading slash if URL does not start with one', () => {
      router = createTestRouter('/app/');

      class TestableService extends NavigationLocationService {
        testSet(
          state: unknown,
          title: string,
          url: string,
          replace: boolean,
        ): void {
          this._set(state, title, url, replace);
        }
      }

      const testService = new TestableService(router);
      testService.testSet(null, '', 'users', false);

      expect(navigateSpy).toHaveBeenCalledWith(
        '/app/users',
        expect.any(Object),
      );

      testService.dispose(router);
      service = null!;
    });
  });

  describe('dispose', () => {
    it('removes currententrychange event listener', () => {
      router = createTestRouter();
      service = new NavigationLocationService(router);

      service.dispose(router);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'currententrychange',
        expect.any(Function),
      );

      // Prevent double dispose in afterEach
      service = null!;
    });
  });
});

// Test real navigate event interception (without mocking navigate)
describe.skipIf(!hasNavigationAPI)(
  'NavigationLocationService navigate event interception',
  () => {
    it('fires navigate event with UIRouter info when navigating', () => {
      const router = createTestRouter('/');
      const service = new NavigationLocationService(router);

      let capturedEvent: NavigateEvent | null = null;
      const navigateHandler = (event: NavigateEvent) => {
        capturedEvent = event;
        event.intercept(); // Prevent actual navigation
      };

      window.navigation.addEventListener('navigate', navigateHandler);

      try {
        service.url('/test-path');

        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.destination.url).toContain('/test-path');
        // Verify the UIRouter info is attached
        expect(isUIRouterNavigateEvent(capturedEvent!)).toBe(true);
      } finally {
        window.navigation.removeEventListener('navigate', navigateHandler);
        service.dispose(router);
      }
    });
  },
);

describe.skipIf(!hasNavigationAPI)('navigationLocationPlugin', () => {
  let _navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock navigate to prevent actual navigation
    _navigateSpy = vi
      .spyOn(window.navigation, 'navigate')
      .mockImplementation(() => ({
        committed: Promise.resolve({} as NavigationHistoryEntry),
        finished: Promise.resolve({} as NavigationHistoryEntry),
      }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a function that returns a LocationPlugin', () => {
    expect(typeof navigationLocationPlugin).toBe('function');

    const router = new UIRouter();
    const plugin = navigationLocationPlugin(router);

    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('vanilla.navigationLocation');

    // Clean up
    if (plugin.dispose) {
      plugin.dispose(router);
    }
  });

  it('plugin provides LocationServices', () => {
    const router = new UIRouter();
    const plugin = navigationLocationPlugin(router);

    expect(router.urlService).toBeDefined();

    // Clean up
    if (plugin.dispose) {
      plugin.dispose(router);
    }
  });
});
