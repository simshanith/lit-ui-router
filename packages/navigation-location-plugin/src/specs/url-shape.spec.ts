/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import { navigationLocationPlugin } from '../index.js';

const hasNavigationAPI =
  typeof window !== 'undefined' && 'navigation' in window;

// Boot + URL-shape invariants for this plugin: it requires window.navigation
// and drives clean (hash-free) URLs through navigation.navigate (hash and
// pushState shapes are asserted in lit-ui-router's location-plugins spec).
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
