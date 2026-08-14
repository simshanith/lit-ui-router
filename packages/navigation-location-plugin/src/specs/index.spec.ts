/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import {
  NavigationLocationService,
  navigationLocationPlugin,
  isUIRouterNavigateEvent,
} from '../index.js';
import { interceptNavigations, restoreUrl } from './real-navigation.js';

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

// The pure isUIRouterNavigateEvent predicate lives in
// is-ui-router-navigate-event.spec.ts, which runs in happy-dom, and the pure
// URL composition in compose-navigate-url.spec.ts, which runs in node.
// Everything that only needs `navigation` stubbed goes through the
// `_navigation()` seam in navigation-service.spec.ts, also happy-dom.
//
// What is left here — and the only thing that belongs here — are real
// round-trips through a real Navigation API: navigations that actually commit,
// URLs that actually change, and events that actually fire. No stubs.

describe.skipIf(!hasNavigationAPI)('NavigationLocationService', () => {
  let router: UIRouter;
  let service: NavigationLocationService | null;
  let stopIntercepting: () => void;
  let originalHref: string;

  beforeEach(() => {
    originalHref = window.location.href;
    stopIntercepting = interceptNavigations();
    router = createTestRouter('/');
    service = new NavigationLocationService(router);
  });

  afterEach(async () => {
    service?.dispose(router);
    service = null;
    stopIntercepting();
    await restoreUrl(originalHref);
  });

  it('really changes the URL when navigating', async () => {
    expect(window.location.pathname).not.toBe('/real-path');

    service!.url('/real-path');

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/real-path');
    });
    expect(window.navigation.currentEntry?.url).toContain('/real-path');
  });

  it('reads the real URL back through url(), including query and hash', async () => {
    service!.url('/read-back?q=1#frag');

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/read-back');
    });
    expect(service!.url()).toBe('/read-back?q=1#frag');
  });

  it('reads the current URL relative to a non-root baseHref', async () => {
    service!.dispose(router);
    router = createTestRouter('/app/');
    service = new NavigationLocationService(router);

    service.url('/deep');

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/app/deep');
    });
    expect(service.url()).toBe('/deep');
  });

  it('fires onChange listeners from a real currententrychange event', async () => {
    const onChange = vi.fn();
    service!.onChange(onChange);

    service!.url('/listener-path');

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    // the callback receives the real NavigationCurrentEntryChangeEvent
    const [event] = onChange.mock.calls[0] as [Event];
    expect(event.type).toBe('currententrychange');
  });

  it('stops firing onChange listeners after dispose', async () => {
    const onChange = vi.fn();
    service!.onChange(onChange);

    service!.url('/before-dispose');
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    service!.dispose(router);
    service = null;
    onChange.mockClear();

    await window.navigation.navigate('/after-dispose', { history: 'push' })
      .finished;
    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/after-dispose');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires navigate event with UIRouter info when navigating', () => {
    let capturedEvent: NavigateEvent | null = null;
    const navigateHandler = (event: NavigateEvent) => {
      capturedEvent = event;
    };

    window.navigation.addEventListener('navigate', navigateHandler);

    try {
      service!.url('/test-path');

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.destination.url).toContain('/test-path');
      // Verify the UIRouter info is attached
      expect(isUIRouterNavigateEvent(capturedEvent!)).toBe(true);
    } finally {
      window.navigation.removeEventListener('navigate', navigateHandler);
    }
  });
});

describe.skipIf(!hasNavigationAPI)('navigationLocationPlugin', () => {
  let stopIntercepting: () => void;
  let originalHref: string;

  beforeEach(() => {
    originalHref = window.location.href;
    stopIntercepting = interceptNavigations();
  });

  afterEach(async () => {
    stopIntercepting();
    await restoreUrl(originalHref);
  });

  // The shape half — that this is a factory, that it returns something, and
  // that what it returns is a LocationPlugin core accepts — is pinned at
  // compile time in ./plugin-seams.types.ts. What stays here is the value the
  // compiler cannot know: the name core keys the registered instance by.
  it('registers under the vanilla.navigationLocation name', () => {
    const router = new UIRouter();
    const plugin = navigationLocationPlugin(router);

    expect(plugin.name).toBe('vanilla.navigationLocation');

    plugin.dispose?.(router);
  });

  it('provides LocationServices that really drive the browser URL', async () => {
    const router = new UIRouter();
    router.urlService.config.baseHref = () => '/';
    const plugin = navigationLocationPlugin(router);

    router.urlService.url('/plugin-path');

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/plugin-path');
    });

    plugin.dispose?.(router);
  });
});
