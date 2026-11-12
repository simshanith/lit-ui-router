/// <reference types="vitest/globals" />
/// <reference types="@types/dom-navigation" />

import { servicesPlugin, UIRouter } from '@uirouter/core';
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

  // A navigation to another origin cannot be intercepted; cancelling it keeps the tester page alive to report the failure.
  describe('a URL that begins with //', () => {
    let leaving: string[];

    const cancelLeaving = (event: NavigateEvent): void => {
      if (!event.canIntercept) {
        leaving.push(event.destination.url);
        event.preventDefault();
      }
    };

    beforeEach(() => {
      leaving = [];
      window.navigation.addEventListener('navigate', cancelLeaving);
    });

    afterEach(() => {
      window.navigation.removeEventListener('navigate', cancelLeaving);
    });

    it.each([
      ['/', '/x.invalid', '/x.invalid'],
      ['/app/', '/app//x.invalid', '//x.invalid'],
    ])(
      'stays on this origin for an empty leading param under %s',
      async (baseHref, pathname, routerUrl) => {
        const router = new UIRouter();
        router.urlService.config.baseHref = () => baseHref;
        const plugin = navigationLocationPlugin(router);
        router.plugin(servicesPlugin);
        router.stateRegistry.register({ name: 'new', url: '/:lang/:slug' });
        const { origin } = window.location;

        await router.stateService.go('new', { lang: '', slug: 'x.invalid' });

        await vi.waitFor(() => {
          expect(window.location.pathname).toBe(pathname);
        });
        expect(leaving).toEqual([]);
        expect(window.location.origin).toBe(origin);
        expect(router.urlService.url()).toBe(routerUrl);

        plugin.dispose?.(router);
      },
    );
  });
});
