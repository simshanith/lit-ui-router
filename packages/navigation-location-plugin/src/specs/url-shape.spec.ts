/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { UIRouter } from '@uirouter/core';
import { navigationLocationPlugin } from '../index.js';
import { interceptNavigations, restoreUrl } from './real-navigation.js';

const hasNavigationAPI =
  typeof window !== 'undefined' && 'navigation' in window;

// Boot + URL-shape invariants for this plugin: it requires window.navigation
// and drives clean (hash-free) URLs through navigation.navigate (hash and
// pushState shapes are asserted in lit-ui-router's location-plugins spec).
// Asserted against the real browser URL, not a spy: a stub can prove which
// string we passed, only a real navigation proves the address bar agrees.
describe.skipIf(!hasNavigationAPI)('navigationLocationPlugin URL shape', () => {
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

  it('routes through window.navigation', async () => {
    const router = new UIRouter();
    router.urlService.config.baseHref = () => '/';
    const plugin = navigationLocationPlugin(router);

    expect(window.navigation).toBeDefined();
    const before = window.navigation.currentEntry;

    router.urlService.url('/home');

    await vi.waitFor(() => {
      expect(window.navigation.currentEntry).not.toBe(before);
    });
    expect(window.navigation.currentEntry?.url).toContain('/home');

    plugin.dispose?.(router);
  });

  it('produces clean URLs without a hash fragment', async () => {
    const router = new UIRouter();
    router.urlService.config.baseHref = () => '/';
    const plugin = navigationLocationPlugin(router);

    router.urlService.url('/home');

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/home');
    });
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('#');

    plugin.dispose?.(router);
  });
});
