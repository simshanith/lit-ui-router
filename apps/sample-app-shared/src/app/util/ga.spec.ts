import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import googleAnalyticsHook from './ga.js';
import { featureFlags } from './featureDetection.js';

const originalHref = window.location.href;

// the tester iframe URL carries params vitest needs, so add to it rather than replace it
const setLocationPlugin = (value: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('feature-location-plugin', value);
  history.replaceState(null, '', url);
};

/**
 * A stand-in for the Navigation API: an EventTarget carrying the one method
 * `canUseNavigationAPI()` probes. Stubbed rather than driven for real so the
 * lane assertions run on every engine, not only the ones shipping the API.
 */
class NavigationStub extends EventTarget {
  navigate() {}

  emit(navigationType: string) {
    this.dispatchEvent(
      Object.assign(new Event('navigate'), { navigationType }),
    );
  }
}

/** The shape of a transition the hook's `path()` reads. */
const fakeTransition = {
  $to: () => ({ url: { format: () => 'users' } }),
  params: () => ({}),
};

/** Captures the onSuccess callback the hook registers, to fire per navigation. */
function fakeTransitionService() {
  let onSuccess: (trans: typeof fakeTransition) => void = () => {};
  const service = {
    onSuccess: (
      _criteria: unknown,
      callback: (trans: typeof fakeTransition) => void,
    ) => {
      onSuccess = callback;
    },
    onError: () => {},
  };
  return { service, success: () => onSuccess(fakeTransition) };
}

describe('googleAnalyticsHook page_view', () => {
  let navigation: NavigationStub;
  let pageViews: unknown[];

  beforeEach(() => {
    featureFlags.resetAll();
    sessionStorage.clear();
    navigation = new NavigationStub();
    vi.stubGlobal('navigation', navigation);
    pageViews = [];
    vi.stubGlobal('gtag', (command: string, name: string, params: unknown) => {
      if (command === 'event' && name === 'page_view') pageViews.push(params);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState(null, '', originalHref);
    featureFlags.resetAll();
    sessionStorage.clear();
  });

  /** Installs the hook under `plugin` and returns a driver for one transition. */
  const install = (plugin: string) => {
    setLocationPlugin(plugin);
    const { service, success } = fakeTransitionService();
    googleAnalyticsHook(service);
    return (navigationType?: string) => {
      if (navigationType) navigation.emit(navigationType);
      success();
    };
  };

  describe('under the Navigation API', () => {
    it('sends a page_view gtag cannot see: push', () => {
      install('navigation')('push');
      expect(pageViews).toHaveLength(1);
    });

    it('sends a page_view gtag cannot see: replace', () => {
      install('navigation')('replace');
      expect(pageViews).toHaveLength(1);
    });

    it('stays silent on traverse — popstate fires and gtag counts it', () => {
      install('navigation')('traverse');
      expect(pageViews).toEqual([]);
    });

    it('stays silent on reload — the new document is gtag config page_view', () => {
      install('navigation')('reload');
      expect(pageViews).toEqual([]);
    });

    it('consumes the navigation kind, so a later transition cannot reuse it', () => {
      const transition = install('navigation');
      transition('push');
      transition(); // a transition with no navigate event of its own
      expect(pageViews).toHaveLength(1);
    });
  });

  describe('under the other location plugins', () => {
    it('sends nothing under pushState — gtag hooks history directly', () => {
      install('pushState')();
      expect(pageViews).toEqual([]);
    });

    it('sends every transition under hash — history is never touched', () => {
      const transition = install('hash');
      transition();
      transition();
      expect(pageViews).toHaveLength(2);
    });
  });
});
