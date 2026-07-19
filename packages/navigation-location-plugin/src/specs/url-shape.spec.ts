/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import { navigationLocationPlugin } from '../index.js';

const hasNavigationAPI =
  typeof window !== 'undefined' && 'navigation' in window;

// URL-shape invariants demoted from the e2e suite's location_plugins.cy.js:
// the navigation e2e suite variant already boots the whole app under this
// plugin, so the plugin-level claims live here — the plugin requires
// window.navigation and drives clean (hash-free) URLs through it.
describe.skipIf(!hasNavigationAPI)('navigationLocationPlugin URL shape', () => {
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    navigateSpy = vi
      .spyOn(window.navigation, 'navigate')
      .mockImplementation(() => ({
        committed: Promise.resolve({} as NavigationHistoryEntry),
        finished: Promise.resolve({} as NavigationHistoryEntry),
      }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes through window.navigation', () => {
    const router = new UIRouter();
    router.urlService.config.baseHref = () => '/';
    const plugin = navigationLocationPlugin(router);

    expect(window.navigation).toBeDefined();
    router.urlService.url('/home');
    expect(navigateSpy).toHaveBeenCalled();

    plugin.dispose?.(router);
  });

  it('produces clean URLs without a hash fragment', () => {
    const router = new UIRouter();
    router.urlService.config.baseHref = () => '/';
    const plugin = navigationLocationPlugin(router);

    router.urlService.url('/home');

    const [url] = navigateSpy.mock.calls[0] as [string];
    expect(url).toBe('/home');
    expect(url).not.toContain('#');

    plugin.dispose?.(router);
  });
});
